// Ebb project site: small, dependency-free interactions.
(() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Sticky nav border once the page scrolls.
  const nav = document.querySelector('.nav');
  const onScroll = () => nav && nav.classList.toggle('scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Scroll reveal, plus a hook for elements that animate once visible.
  const seen = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('in');
      e.target.dispatchEvent(new CustomEvent('reveal'));
      seen.unobserve(e.target);
    }
  }, { threshold: 0.18, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('.reveal, [data-count], .price.old').forEach((el) => seen.observe(el));

  // Count-up numbers.
  document.querySelectorAll('[data-count]').forEach((el) => {
    const target = Number(el.dataset.count);
    const prefix = el.dataset.prefix ?? '';
    const suffix = el.dataset.suffix ?? '';
    el.textContent = `${prefix}${reduce ? target : 0}${suffix}`;
    if (reduce) return;
    el.addEventListener('reveal', () => {
      const start = performance.now();
      const dur = 1400;
      const tick = (t) => {
        const k = Math.min(1, (t - start) / dur);
        const eased = 1 - Math.pow(1 - k, 3);
        el.textContent = `${prefix}${Math.round(target * eased)}${suffix}`;
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { once: true });
  });

  // Hero phone: cycle through real app screenshots.
  const screen = document.querySelector('.screen');
  if (screen) {
    const imgs = [...screen.querySelectorAll('img')];
    const dotsWrap = document.querySelector('.dots');
    let i = 0;
    let timer;
    const dots = imgs.map((img, n) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', `Show ${img.alt}`);
      b.addEventListener('click', () => { show(n); restart(); });
      dotsWrap?.appendChild(b);
      return b;
    });
    const show = (n) => {
      i = (n + imgs.length) % imgs.length;
      imgs.forEach((img, k) => img.classList.toggle('on', k === i));
      dots.forEach((d, k) => d.setAttribute('aria-current', String(k === i)));
    };
    const restart = () => {
      clearInterval(timer);
      if (!reduce) timer = setInterval(() => show(i + 1), 3400);
    };
    show(0);
    restart();
    const phone = screen.closest('.phone');
    phone?.addEventListener('mouseenter', () => clearInterval(timer));
    phone?.addEventListener('mouseleave', restart);
  }

  // Card glow follows the pointer.
  document.querySelectorAll('.card').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  });

  // Cycle explainer: a 28-day strip with a marker walking through the phases.
  const strip = document.querySelector('.strip');
  if (strip) {
    const phases = [
      { name: 'Period', from: 1, to: 5, color: 'var(--accent)', text: 'Bleeding days you log. Spotting never starts a new period, and bleeding days close together count as one.' },
      { name: 'Follicular', from: 6, to: 8, color: 'var(--follicular)', text: 'Oestrogen rises as an egg matures. Ebb shows this as a calm stretch before the fertile window.' },
      { name: 'Fertile window', from: 9, to: 13, color: 'var(--fertile-soft)', text: 'Five days before ovulation, when sperm can still be waiting. A cautious mode widens this by two days on each side.' },
      { name: 'Ovulation', from: 14, to: 14, color: 'var(--ovulation)', text: 'Estimated by counting your luteal phase back from the next period. A temperature rise or positive LH test can refine it.' },
      { name: 'Fertile window', from: 15, to: 15, color: 'var(--fertile-soft)', text: 'The day after ovulation is still counted as fertile.' },
      { name: 'Luteal', from: 16, to: 23, color: 'var(--luteal)', text: 'Progesterone rises and temperature stays a little higher until the next period.' },
      { name: 'Premenstrual', from: 24, to: 28, color: 'var(--pms-soft)', text: 'The five days before a period, where Ebb looks for symptoms that keep coming back.' },
    ];
    const phaseOf = (d) => phases.find((p) => d >= p.from && d <= p.to);
    const cells = [];
    for (let d = 1; d <= 28; d += 1) {
      const s = document.createElement('span');
      s.style.background = phaseOf(d).color;
      s.title = `Day ${d}: ${phaseOf(d).name}`;
      strip.appendChild(s);
      cells.push(s);
    }
    const dayEl = document.querySelector('.strip-day');
    const phaseEl = document.querySelector('.strip-phase');
    const copyEl = document.querySelector('.strip-copy');
    let day = 1;
    let last;
    const render = () => {
      cells.forEach((c, k) => c.classList.toggle('now', k + 1 === day));
      const p = phaseOf(day);
      dayEl.textContent = day;
      phaseEl.textContent = p.name;
      phaseEl.style.color = p.name === 'Fertile window' ? 'var(--fertile)' : p.name === 'Premenstrual' ? 'var(--pms)' : p.color;
      if (last !== p) { copyEl.textContent = p.text; last = p; }
    };
    render();
    if (!reduce) {
      let running = false;
      let timer;
      const io = new IntersectionObserver(([e]) => {
        if (e.isIntersecting && !running) { running = true; timer = setInterval(() => { day = day % 28 + 1; render(); }, 650); }
        if (!e.isIntersecting && running) { running = false; clearInterval(timer); }
      });
      io.observe(strip);
    }
    cells.forEach((c, k) => c.addEventListener('click', () => { day = k + 1; render(); }));
  }

  // Screens gallery: phones fan out as the section scrolls into view.
  const gallery = document.querySelector('.gallery');
  if (gallery && !reduce) {
    const shots = [...gallery.querySelectorAll('.shot')];
    const mid = (shots.length - 1) / 2;
    const wide = window.matchMedia('(min-width: 721px)');
    let ticking = false;
    const update = () => {
      ticking = false;
      if (!wide.matches) { shots.forEach((s) => { s.style.transform = ''; s.style.removeProperty('--cap'); }); return; }
      const r = gallery.getBoundingClientRect();
      const vh = window.innerHeight;
      const t = Math.max(0, Math.min(1, (vh - r.top) / (vh + r.height * 0.4)));
      const spread = Math.min(1, t * 1.6);
      const w = Math.min(window.innerWidth, 1160);
      shots.forEach((s, k) => {
        const o = k - mid;
        const x = o * spread * (w / 5.2);
        const rot = o * (1 - spread * 0.7) * 7;
        const y = Math.abs(o) * 22 * spread;
        const z = -Math.abs(o) * 60;
        s.style.transform = `translate3d(${x}px, ${y}px, ${z}px) rotateY(${-o * 6 * spread}deg) rotate(${rot}deg)`;
        s.style.zIndex = String(10 - Math.abs(o));
        s.style.setProperty('--cap', String(Math.max(0, (spread - 0.7) / 0.3)));
      });
    };
    const req = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    window.addEventListener('scroll', req, { passive: true });
    window.addEventListener('resize', req);
    update();
  }

  // Copy buttons on code blocks.
  document.querySelectorAll('.code .copy').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const text = btn.parentElement.querySelector('code').innerText.replace(/^\$ /gm, '');
      try {
        await navigator.clipboard.writeText(text);
        btn.textContent = 'Copied';
      } catch {
        btn.textContent = 'Select and copy';
      }
      setTimeout(() => { btn.textContent = 'Copy'; }, 1800);
    });
  });

  document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = String(new Date().getFullYear()); });
})();
