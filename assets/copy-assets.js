import fs from 'fs';
import path from 'path';

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  let entries = fs.readdirSync(src, { withFileTypes: true });

  for (let entry of entries) {
    let srcPath = path.join(src, entry.name);
    let destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Copy directories to dist
const dirs = ['html', 'js', 'css', 'assets'];
for (let dir of dirs) {
  if (fs.existsSync(dir)) {
    copyDir(dir, path.join('dist', dir));
    console.log(`Copied ${dir} to dist/${dir}`);
  }
}
