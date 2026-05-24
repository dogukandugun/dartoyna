(function () {
  const SINGLES = Array.from({ length: 20 }, (_, i) => ({ name: String(i + 1), val: i + 1 }));
  const DOUBLES = Array.from({ length: 20 }, (_, i) => ({ name: `D${i + 1}`, val: (i + 1) * 2 }));
  const TREBLES = Array.from({ length: 20 }, (_, i) => ({ name: `T${i + 1}`, val: (i + 1) * 3 }));
  const SPECIAL = [{ name: 'Bull', val: 25 }, { name: 'D-Bull', val: 50 }];

  // Tüm dartlar (ilk/orta dart için)
  const ALL = [...TREBLES, ...DOUBLES, ...SPECIAL, ...SINGLES].sort((a, b) => b.val - a.val);
  // Sadece geçerli bitiş dartları (son dart double, triple veya bull olmalı)
  const FINISH = [...TREBLES, ...DOUBLES, ...SPECIAL].sort((a, b) => b.val - a.val);

  const CHECKOUTS = {};

  for (let score = 2; score <= 180; score++) {
    // 1 dart ile bitiş
    const d1 = FINISH.find(d => d.val === score);
    if (d1) { CHECKOUTS[score] = d1.name; continue; }

    // 2 dart ile bitiş
    let found = false;
    for (const a of ALL) {
      if (a.val >= score) continue;
      const b = FINISH.find(d => d.val === score - a.val);
      if (b) { CHECKOUTS[score] = `${a.name} ${b.name}`; found = true; break; }
    }
    if (found) continue;

    // 3 dart ile bitiş
    for (const a of ALL) {
      if (a.val >= score) continue;
      const r1 = score - a.val;
      for (const b of ALL) {
        if (b.val >= r1) continue;
        const c = FINISH.find(d => d.val === r1 - b.val);
        if (c) { CHECKOUTS[score] = `${a.name} ${b.name} ${c.name}`; found = true; break; }
      }
      if (found) break;
    }
  }

  window.CHECKOUTS = CHECKOUTS;
})();
