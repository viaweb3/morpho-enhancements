// Runs in the page's MAIN world. Discovers the connected EIP-1193 provider
// via EIP-6963 + window.ethereum, and proxies requests from the content
// script (ISOLATED world) via window.postMessage.
//
// Shipped as plain JS in public/ so crxjs doesn't wrap it with a
// chrome.runtime.getURL loader (MAIN world has no chrome.* API).
//
// Protocol on window events:
//   from content: { source: 'morpho-ext/cs', id, method, params?, providerUuid? }
//   to content:   { source: 'morpho-ext/page', id, result? , error? }
//   announce:     { source: 'morpho-ext/page', type: 'providers', providers }

(function init() {
  if (window.__morphoExtBridgeInstalled) return;
  window.__morphoExtBridgeInstalled = true;

  var SRC_CS = 'morpho-ext/cs';
  var SRC_PAGE = 'morpho-ext/page';

  var providers = new Map();
  var activeListeners = new WeakMap();

  // 1) Discover EIP-6963 providers
  window.addEventListener('eip6963:announceProvider', function (ev) {
    var detail = ev && ev.detail;
    if (!detail || !detail.info || !detail.info.uuid) return;
    providers.set(detail.info.uuid, detail);
    announce();
  });
  window.dispatchEvent(new Event('eip6963:requestProvider'));

  // 2) Fallback: legacy window.ethereum
  var legacyProvider = window.ethereum;
  if (legacyProvider) {
    providers.set('legacy:window.ethereum', {
      info: {
        uuid: 'legacy:window.ethereum',
        name: 'Injected',
        icon: '',
        rdns: 'window.ethereum',
      },
      provider: legacyProvider,
    });
  }

  function announce() {
    var list = [];
    providers.forEach(function (p) {
      list.push({
        uuid: p.info.uuid,
        name: p.info.name,
        icon: p.info.icon,
        rdns: p.info.rdns,
      });
    });
    window.postMessage(
      { source: SRC_PAGE, type: 'providers', providers: list },
      '*',
    );
  }

  function pickProvider(uuid) {
    if (uuid && providers.has(uuid)) return providers.get(uuid);
    // Prefer the first EIP-6963 provider, else legacy
    var first = null;
    providers.forEach(function (p, key) {
      if (first) return;
      if (!String(key).startsWith('legacy:')) first = p;
    });
    return first || providers.get('legacy:window.ethereum');
  }

  function attachListeners(p) {
    if (!p || typeof p.on !== 'function' || activeListeners.has(p)) return;
    function onAccounts(accounts) {
      window.postMessage(
        { source: SRC_PAGE, type: 'accountsChanged', accounts: accounts },
        '*',
      );
    }
    function onChain(chainId) {
      window.postMessage(
        { source: SRC_PAGE, type: 'chainChanged', chainId: chainId },
        '*',
      );
    }
    p.on('accountsChanged', onAccounts);
    p.on('chainChanged', onChain);
    activeListeners.set(p, { accounts: onAccounts, chain: onChain });
  }

  window.addEventListener('message', function (event) {
    if (event.source !== window) return;
    var msg = event.data;
    if (!msg || msg.source !== SRC_CS) return;

    var id = msg.id;
    var method = msg.method;
    var params = msg.params;
    var providerUuid = msg.providerUuid;

    if (method === 'morpho-ext/listProviders') {
      announce();
      return;
    }

    var chosen = pickProvider(providerUuid);
    if (!chosen) {
      window.postMessage(
        {
          source: SRC_PAGE,
          id: id,
          error: {
            code: -32603,
            message: 'No EIP-1193 provider found on this page',
          },
        },
        '*',
      );
      return;
    }

    attachListeners(chosen.provider);

    Promise.resolve()
      .then(function () {
        return chosen.provider.request({ method: method, params: params });
      })
      .then(function (result) {
        window.postMessage({ source: SRC_PAGE, id: id, result: result }, '*');
      })
      .catch(function (err) {
        var code = err && err.code != null ? err.code : -32603;
        var message = err && err.message ? err.message : String(err);
        window.postMessage(
          { source: SRC_PAGE, id: id, error: { code: code, message: message } },
          '*',
        );
      });
  });
})();
