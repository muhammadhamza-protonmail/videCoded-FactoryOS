const fs = require('fs');
const path = require('path');

const appDir = path.join(__dirname, '..', 'src', 'app');

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (entry.name === 'page.js') files.push(full);
  }
  return files;
}

const modalBlock = /function Modal\(\{[\s\S]*?\n\}\n\n/;

const importBlock = `import Modal from '../../../components/Modal';
import FormActions from '../../../components/FormActions';
import PageHeader from '../../../components/PageHeader';
`;

const files = walk(appDir);
console.log('Found', files.length, 'page files');

for (const file of files) {
  let src = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  let changed = false;

  if (modalBlock.test(src)) {
    src = src.replace(modalBlock, '');
    src = src.replace(/, X(?=,|\s+})/g, '');
    src = src.replace(/<Modal([^>]*)\bwide\b/g, '<Modal$1size="lg"');
    if (!src.includes('components/Modal')) {
      const firstImport = src.indexOf('import ');
      const lineEnd = src.indexOf('\n', firstImport);
      src = `${src.slice(0, lineEnd + 1)}${importBlock}${src.slice(lineEnd + 1)}`;
    }
    changed = true;
  }

  const t1 = src;
  src = src.replace(
    /className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">\n\s*<div className="table-scroll">/g,
    'className="table-panel bg-white rounded-2xl shadow-sm border border-gray-100">\n                <div className="table-scroll">'
  );
  if (src !== t1) changed = true;

  const t2 = src;
  src = src.replace(/className="flex gap-3 mt-2"/g, 'className="form-actions"');
  src = src.replace(/className="flex gap-3 mt-4"/g, 'className="form-actions mt-4"');
  src = src.replace(/className="flex gap-3 pt-2"/g, 'className="form-actions pt-2"');
  src = src.replace(/className="flex gap-3 pt-4"/g, 'className="form-actions pt-4"');
  src = src.replace(/className="flex gap-2 mt-6"/g, 'className="form-actions mt-6"');
  if (src !== t2) changed = true;

  const t3 = src;
  src = src.replace(
    /<div className="flex gap-2">\n\s*\{\['all',/g,
    "<motion className=\"filter-scroll\">\n                        {['all',"
  );
  src = src.replace(/<motion className="filter-scroll">/g, '<motion className="filter-scroll">'.replace('motion', 'motion')); // no-op fix below
  src = src.replace(/<motion className="filter-scroll">/g, '<div className="filter-scroll">');
  if (src !== t3) changed = true;

  if (changed) {
    fs.writeFileSync(file, src, 'utf8');
    console.log('Updated', path.relative(path.join(__dirname, '..'), file));
  }
}
