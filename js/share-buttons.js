(function () {
  var mount = document.getElementById('post-share');
  if (!mount) return;

  var canonical = document.querySelector('link[rel="canonical"]');
  var url = canonical ? canonical.href : window.location.href;
  var title = document.title.replace(/\s*\|\s*Photoczaro\s*$/, '');

  var links = [
    {
      label: 'WhatsApp',
      href: 'https://wa.me/?text=' + encodeURIComponent(title + ' ' + url)
    },
    {
      label: 'Email',
      href: 'mailto:?subject=' + encodeURIComponent(title) + '&body=' + encodeURIComponent(url)
    }
  ];

  var wrap = document.createElement('div');
  wrap.style.display = 'flex';
  wrap.style.alignItems = 'center';
  wrap.style.gap = '14px';

  var label = document.createElement('span');
  label.textContent = 'Share';
  label.style.fontSize = '10px';
  label.style.letterSpacing = '0.18em';
  label.style.textTransform = 'uppercase';
  label.style.color = 'var(--grey)';
  wrap.appendChild(label);

  links.forEach(function (link) {
    var a = document.createElement('a');
    a.href = link.href;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = link.label;
    a.style.fontSize = '10px';
    a.style.letterSpacing = '0.14em';
    a.style.textTransform = 'uppercase';
    a.style.color = 'var(--gold-light)';
    a.style.textDecoration = 'none';
    a.style.borderBottom = '0.5px solid rgba(232,213,163,0.35)';
    a.style.paddingBottom = '2px';
    wrap.appendChild(a);
  });

  var copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.textContent = 'Copy Link';
  copyBtn.style.font = 'inherit';
  copyBtn.style.fontSize = '10px';
  copyBtn.style.letterSpacing = '0.14em';
  copyBtn.style.textTransform = 'uppercase';
  copyBtn.style.color = 'var(--gold-light)';
  copyBtn.style.background = 'none';
  copyBtn.style.border = 'none';
  copyBtn.style.borderBottom = '0.5px solid rgba(232,213,163,0.35)';
  copyBtn.style.paddingBottom = '2px';
  copyBtn.style.cursor = 'pointer';
  copyBtn.addEventListener('click', function () {
    navigator.clipboard.writeText(url).then(function () {
      var original = copyBtn.textContent;
      copyBtn.textContent = 'Copied';
      setTimeout(function () {
        copyBtn.textContent = original;
      }, 1800);
    });
  });
  wrap.appendChild(copyBtn);

  mount.appendChild(wrap);
})();
