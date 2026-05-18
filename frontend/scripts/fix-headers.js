const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

const targets = [
  ['src/app/payments/page.js', 'Payments', 'Record and track customer payments', 'payments', 'Record Payment'],
  ['src/app/production/page.js', 'Production', 'Log production runs and material usage', 'production', 'Log Production'],
  ['src/app/vendors/page.js', 'Vendors', 'Manage suppliers and payables', 'vendors', 'Add Vendor'],
  ['src/app/users/page.js', 'Users', 'Manage team members and permissions', 'users', 'Add User'],
  ['src/app/rawmaterials/page.js', 'Raw Materials', 'Track materials and stock levels', 'rawmaterials', 'Add Material'],
  ['src/app/inventory/page.js', 'Inventory', 'Stock overview and adjustments', 'inventory', null],
  ['src/app/products/page.js', 'Products', 'Manage finished goods and stock levels', 'products', 'Add Product'],
];

for (const [rel, title, subtitle, module, btnLabel] of targets) {
  const file = path.join(root, rel);
  let src = fs.readFileSync(file, 'utf8');

  const headerPattern = new RegExp(
    `\\{\\/\\*[\\s\\S]*?Header[\\s\\S]*?\\*\\/\\}\\s*\\n\\s*<div className="flex items-center justify-between">[\\s\\S]*?<\\/motion>\\s*\\n`,
    'm'
  );

  if (!headerPattern.test(src)) {
    console.log('Skip (no match)', rel);
    continue;
  }

  const action = btnLabel
    ? `action={can('${module}', 'add') ? (
                    <button
                        type="button"
                        onClick={() => { setForm(emptyForm); setShowAdd(true); }}
                        className="flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-sm min-h-[44px]"
                    >
                        <Plus size={18} />
                        ${btnLabel}
                    </button>
                ) : null}`
  : 'action={null}';

  const replacement = `<PageHeader
                title="${title}"
                subtitle="${subtitle}"
                ${action}
            />\n\n`;

  src = src.replace(headerPattern, replacement);
  fs.writeFileSync(file, src, 'utf8');
  console.log('Fixed', rel);
}
