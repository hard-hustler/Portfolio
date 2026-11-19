// Builds the HTML layers from data.js. No 3D here.
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const STOPS = [
    { id: 'start', name: 'Start', c: '#f2b233', L: 'H' },
    { id: 'projects', name: 'Projects', c: '#44a9e8', L: 'P' },
    { id: 'experience', name: 'Experience', c: '#ec5a3c', L: 'X' },
    { id: 'skills', name: 'Skills', c: '#37b56f', L: 'S' },
    { id: 'education', name: 'Education', c: '#a385ea', L: 'E' },
    { id: 'awards', name: 'Awards', c: '#f28fb1', L: 'A' },
    { id: 'contact', name: 'Last stop', c: '#f2b233', L: 'H' },
  ];
  window.STOPS = STOPS;
  const N = STOPS.length;
  const pad = (n) => String(n).padStart(3, '0');

  // Line map
  $('linemap').innerHTML = STOPS.map((s, i) => `<li data-i="${i}" style="--c:${s.c}"><i></i><b>${s.name}</b></li>`).join('');

  const stubLines = STOPS.map((s, i) => `<li data-i="${i}" style="--c:${s.c}"><span class="mini">${s.L}</span>${s.name}</li>`).join('');
  const punch = (k) => STOPS.map((_, i) => `<li class="${i < k ? 'done' : i === k ? 'now' : ''}">${i + 1}</li>`).join('');
  const boarded = () => {
    const d = new Date();
    return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short' }).toUpperCase() + ' ' + d.toTimeString().slice(0, 5);
  };

  // Start ticket
  $('dock-start').innerHTML = `
  <article class="tk">
    <div class="tk-main">
      <div class="band"><span>Night line</span><span>Stop 1 of ${N}</span><span class="serial">No. 000 001</span></div>
      <div class="body">
        <div class="head"><span class="bullet" style="--c:#f2b233">H</span><div><h1>${esc(SITE.name)}</h1><p class="role">${esc(SITE.role)}</p></div></div>
        <p class="lead">${esc(SITE.lead)}</p>
        <ul class="facts">${SITE.facts.map((f) => `<li>${f[0]}</li>`).join('')}</ul>
      </div>
      <div class="trip">
        <div class="leg"><span class="lbl">Scroll to depart for</span><b>Projects</b></div>
        <p class="stamp">Boarded<br>${boarded()}</p>
        <div><span class="lbl">Punched at each stop</span><ol class="punch">${punch(0)}</ol></div>
      </div>
    </div>
    <aside class="tk-stub">
      <div class="band"><span>Night line</span><span class="serial">000 001</span></div>
      <div class="stub-body"><p class="tag">On this line</p><ol class="lines">${stubLines}</ol><div class="barcode"></div><span class="stub-foot">Valid to last stop</span></div>
    </aside>
  </article>`;

  // Last-stop ticket
  $('dock-end').innerHTML = `
  <article class="tk">
    <div class="tk-main">
      <div class="band"><span>Night line</span><span>Stop ${N} of ${N}</span><span class="serial">No. 000 00${N}</span></div>
      <div class="body">
        <div class="head"><span class="bullet" style="--c:#f2b233">H</span><div><h1>Last stop</h1><p class="role">Contact</p></div></div>
        <p class="lead">Hiring for data or AI engineering? Let's talk.</p>
        <div class="links">${SITE.links.map((l) => `<a href="${l[2]}" target="_blank" rel="noopener">${l[0]}<small>${esc(l[1])}</small></a>`).join('')}</div>
      </div>
      <div class="trip">
        <div class="leg"><span class="lbl">Terminal</span><b>End of the line</b></div>
        <p class="stamp">Arrived<br>${boarded()}</p>
        <div><span class="lbl">Punched at each stop</span><ol class="punch">${punch(N - 1)}</ol></div>
      </div>
    </div>
    <aside class="tk-stub">
      <div class="band"><span>Night line</span><span class="serial">000 00${N}</span></div>
      <div class="stub-body"><span class="passenger">Passenger</span><p class="pname">${esc(SITE.name)}</p><p class="pdesc">${esc(SITE.role)}. Data pipelines, agents and the interfaces between them.</p><div class="barcode"></div><span class="stub-foot">End of the line</span></div>
    </aside>
  </article>`;

  // Project plates + meter
  const linkLabel = (url) => (/github\.com/.test(url) ? 'GitHub' : /youtube/.test(url) ? 'YouTube' : 'Post');
  $('plates').innerHTML = PROJECTS.map((p, i) => `<div class="plate" data-i="${i}"><button class="open" type="button"><span class="n">${String(i + 1).padStart(2, '0')}</span>${esc(p.name)}</button><a class="go" href="${p.url}" target="_blank" rel="noopener" aria-label="Open ${esc(p.name)} on ${linkLabel(p.url)}" title="Open on ${linkLabel(p.url)}">${linkLabel(p.url)} ↗</a></div>`).join('');
  $('cars').innerHTML = Array.from({ length: Math.ceil(PROJECTS.length / 3) }, (_, c) => `<span>${[0, 1, 2].map((k) => `<i data-w="${c * 3 + k}"></i>`).join('')}</span>`).join('');

  // Experience: one caption per lantern on the bridge
  $('lans').innerHTML = EXPERIENCE.map((e, i) => `
    <div class="lan" data-i="${i}" style="--c:${e.color}">
      <div class="lan-head">${e.logo ? `<span class="logo" style="background-image:url('${e.logo}')"></span>` : `<span class="logo" style="background:${e.color}">${e.letter}</span>`}
        <div><h3>${esc(e.org)}</h3><p class="r">${esc(e.role)}</p></div></div>
      <p class="lan-when">${esc(e.when)}</p>
      <p class="lan-stat"><b>${esc(e.stat)}</b> ${esc(e.statLbl)}</p>
    </div>`).join('');

  // Skills list for the constellations
  window.SKILL_LIST = [];
  SKILLS.forEach((g, gi) => g.items.forEach((it) => SKILL_LIST.push({ name: it, color: g.color, group: g.group, gi })));

  // Education in the air
  $('edx').innerHTML = EDUCATION.map((e, i) => `
    <div class="blk" data-i="${i}" style="left:max(24px,5vw);top:13vh">
      <div class="mark"><img src="${e.logo}" alt=""><span class="kick">${i === 0 ? 'Now studying' : 'Where it started'}</span></div>
      <h2>${esc(e.school)}</h2>
      <p class="unit">${esc(e.unit)}</p>
      <p class="deg">${esc(e.degree)} · ${esc(e.when)}<br>${esc(e.note)}</p>
      ${e.courses ? `<p class="crs">${esc(e.courses)}</p>` : ''}
    </div>`).join('');

  // Awards in the air
  const paper = AWARDS.find((a) => a.url);
  $('aw').innerHTML = `<div class="aw-top"><h2><span class="bullet" style="--c:#f28fb1">A</span>Achievements &amp; publications</h2>${paper ? `<a href="${paper.url}" target="_blank" rel="noopener">Read the IEEE paper ↗</a>` : ''}</div>`;

  // Project dialog
  const scrim = $('scrim');
  window.openProject = (i) => {
    const p = PROJECTS[i];
    $('pnl-n').textContent = String(i + 1).padStart(2, '0');
    $('pnl-title').textContent = p.name;
    $('pnl-meta').textContent = p.sub + ' · ' + p.year;
    $('pnl-desc').textContent = p.desc;
    $('pnl-tech').innerHTML = p.tech.map((t) => `<span>${esc(t)}</span>`).join('');
    const a = $('pnl-link');
    a.href = p.url;
    a.textContent = /github\.com/.test(p.url) ? 'Open on GitHub' : /youtube/.test(p.url) ? 'Watch on YouTube' : 'Read the post';
    const m = $('pnl-media');
    if (p.yt) m.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${p.yt}?autoplay=1&start=${p.start || 0}&rel=0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" title="${esc(p.name)} demo"></iframe>`;
    else if (p.img) m.innerHTML = `<img src="${p.img}" alt="${esc(p.name)} screenshot">`;
    else m.innerHTML = '';
    m.style.display = m.innerHTML ? '' : 'none';
    scrim.hidden = false;
    $('pnl-x').focus();
  };
  const close = () => { scrim.hidden = true; $('pnl-media').innerHTML = ''; };
  $('pnl-x').onclick = close;
  scrim.addEventListener('click', (e) => { if (e.target === scrim) close(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !scrim.hidden) close(); });
  $('plates').addEventListener('click', (e) => { const b = e.target.closest('.open'); if (b) openProject(+b.closest('.plate').dataset.i); });
})();
