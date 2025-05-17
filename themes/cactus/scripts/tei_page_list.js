const fs = require('fs');
const path = require('path');

// Recursive function to find all TEI files
function findTEIFiles(directory, basePath = "") {
  let teiFiles = [];

  fs.readdirSync(directory, { withFileTypes: true }).forEach(entry => {
    const fullPath = path.join(directory, entry.name);
    const relativePath = path.join(basePath, entry.name);

    if (entry.isDirectory()) {
      // Recursively search in subdirectories
      teiFiles = teiFiles.concat(findTEIFiles(fullPath, relativePath));
    } else if (entry.isFile() && entry.name.endsWith('.xml')) {
      teiFiles.push(relativePath);
    }
  });

  return teiFiles;
}

// Register helper
hexo.extend.helper.register('getTEIPageList', function (teiFolder) {
  console.log("Generating TEI Page List...");

  if (!fs.existsSync(teiFolder)) {
    console.warn("TEI folder not found!");
    return '<p>No TEI files found.</p>';
  }

  // Get all TEI files recursively
  const files = findTEIFiles(teiFolder);

  if (files.length === 0) {
    return '<p>No TEI files available.</p>';
  }

  // Generate HTML list
  let outputHTML = '<ul class="post-list">';
  files.forEach(file => {
    const fileNameWithoutExt = path.basename(file, path.extname(file));
    const displayName = fileNameWithoutExt.replace(/[-_]/g, ' '); // Remove encoding characters
    const encodedFilePath = encodeURIComponent(file); // Encode path for URL safety
    const fileURL = `/../TEI_Render.html?file=${encodedFilePath}`;

    outputHTML += `<li class="post-item collapse-folder"><a href="${fileURL}">${displayName}</a></li>`;
  });
  outputHTML += '</ul>';

  return outputHTML;
});
