const prisma = require('../src/prisma');

async function backfill() {
  const sales = await prisma.sale.findMany({
    where: { orderChannel: null },
    select: { id: true, notes: true, orderType: true },
  });

  console.log(`Found ${sales.length} sales with orderChannel = null`);

  let updated = 0;
  const details = [];

  for (const sale of sales) {
    let channel = null;

    // Try to derive channel from notes field
    if (sale.notes) {
      const match = sale.notes.match(/قناة:\s*(.+)/);
      if (match) {
        const label = match[1].trim();
        if (/كيتا|keeta/i.test(label)) channel = 'KEETA';
        else if (/هنقر|hunger/i.test(label)) channel = 'HUNGER';
        else if (/واتساب|whatsapp/i.test(label)) channel = 'WHATSAPP';
        else if (/هاتف|phone/i.test(label)) channel = 'PHONE';
        else if (/مندوب/i.test(label)) channel = 'KALD';
        else if (/مباشر|direct/i.test(label)) channel = 'DIRECT';
        else channel = label.toUpperCase();
      }
    }

    // If no note match, derive from orderType
    if (!channel) {
      if (sale.orderType === 'DELIVERY') {
        channel = 'DELIVERY'; // generic delivery, no specific channel recoverable
      } else {
        channel = 'DIRECT';
      }
    }

    await prisma.sale.update({
      where: { id: sale.id },
      data: { orderChannel: channel },
    });

    details.push({ id: sale.id.slice(0, 8), notes: sale.notes || '(none)', orderType: sale.orderType, assigned: channel });
    updated++;
  }

  console.log(`Updated: ${updated}`);
  console.log('');
  for (const d of details) {
    console.log(`  ${d.id}  type=${(d.orderType || 'null').padEnd(10)}  notes="${d.notes}"  → ${d.assigned}`);
  }

  const remaining = await prisma.sale.count({ where: { orderChannel: null } });
  console.log(`\nRemaining null: ${remaining}`);

  await prisma.$disconnect();
}

backfill().catch(e => { console.error(e); process.exit(1); });
