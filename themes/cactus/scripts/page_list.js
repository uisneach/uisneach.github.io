const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

/*
/ This helper will scan the file structure of the pages folder and construct a properly-formatted list of all pages it finds within.
/ There can be many scenarios for how files are stored: each folder can hold a number of subdirectories and markdown files (all non-markdown
/ files will be ignored).
/ Scenario A: 0 Subdirectories, 0 Markdown Files -> Ignore
/ Scenario B: 0 Subdirectories, 1 Markdown File -> 'Collapse Folder', treat the parent folder as if it isn't a folder, instead just a file.
/ Scenario C: 0 Subdirectories, 2 or More Markdown Files -> 'List All', we need no recursion, simply list all files as files.
/ Scenario D: 1 Subdirectory, 0 Markdown Files -> 'Pass Along', recurse into the subdirectory. If that is a 'B', prepend & append <ul> tags.
/ Scenario E: 1 Subdirectory, 1 Markdown Files -> Same as 'I', full recursion.
/ Scenario F: 1 Subdirectory, 2 or More Markdown Files -> Same as 'I', full recursion.
/ Scenario G: 2 or More Subdirectories, 0 Markdown Files -> Same as 'D', recurse into subdirectories.
/ Scenario H: 2 or More Subdirectories, 1 Markdown Files -> Same as 'I', full recursion.
/ Scenario I: 2 or More Subdirectories, 2 or More Markdown Files -> 'Full Recursion', recurse through all subdirectories and list all files.
*/

// Register helper
hexo.extend.helper.register('getRecursivePageList', function (baseDir) {
  const allPages = hexo.locals.get('pages').toArray();

  // Helper function to format directory names
  const formatDirName = (name) => {
    return name
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const dateFromFrontmatter = (filePath) => {
    const fileContents = fs.readFileSync(filePath, 'utf-8');

    // Extract the front matter block using a regex
    const frontMatterMatch = fileContents.match(/^---\n([\s\S]*?)\n---/);

    if (frontMatterMatch) {
      const frontMatter = frontMatterMatch[1];

      // Parse YAML to extract fields
      const parsedFrontMatter = yaml.load(frontMatter);
      
      // Check if there's a date field
      if (parsedFrontMatter.date) {
        const date = new Date(parsedFrontMatter.date);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    }

    // Return null if no date is found in front matter
    return null;
  };

  const titleFromFrontMatter = (filePath) => {
    const fileContents = fs.readFileSync(filePath, 'utf-8');

    // Extract the front matter block using a regex
    const frontMatterMatch = fileContents.match(/^---\n([\s\S]*?)\n---/);

    if (frontMatterMatch) {
      const frontMatter = frontMatterMatch[1];

      // Parse YAML to extract fields
      const parsedFrontMatter = yaml.load(frontMatter);
      
      // Check if there's a title field
      if (parsedFrontMatter.title) {
        return parsedFrontMatter.title;
      }
    }
    else
    {
      console.log("ERROR: Could not extract front matter from page.");
    }

    // Return null if no title is found in front matter
    return null;
  };

  const processMarkdown = (markdownFiles, directoryPath, layer) => {
    let html = '';
    html += '<ul class="post-list" style="margin-left: ' + ((layer > 0) ? 10 : 0) + 'px;">';
    markdownFiles.forEach(file => {
        const filePath = path.join(directoryPath, file);
        const title = titleFromFrontMatter(filePath);
        const dateText = dateFromFrontmatter(filePath);
        
        // console.log(title + " at Layer " + layer);

        if (title)
          // Construct HTML elements. See partials title.ejs and date.ejs.
          html += `<li class="post-item">
                   <div class="meta">${dateText}</div>
                   <div><a href="${hexoLink(filePath)}">${title}</a></div>
                 </li>`;
      });
    html += '</ul>';
    return html;
  };

  const processSubdirectories = (subdirectories, directoryPath, layer) => {
    let html = '';

    // Process each subdirectory recursively
      subdirectories.forEach(subdir => {
        const subdirPath = path.join(directoryPath, subdir);
        const formattedSubdir = formatDirName(subdir);
        const nestedListHtml = buildNestedList(subdirPath, layer);

        if (nestedListHtml.includes('collapse-folder')) // If the subdirectory counts as a 'collapsed folder', i.e. a folder with only one file and no subfolders, we must apply CSS here through a list.
          html += '<ul class="post-list" style="margin-left: ' + ((layer > 0) ? 10 : 0) + 'px;">' + nestedListHtml + '</ul>';
        else
          html += nestedListHtml;
      });

      return html;
  };

  const parentFolderName = (directoryPath) => {
    const folderName = directoryPath.split('/').pop();
    const formattedName = formatDirName(folderName);

    // Check if formatted name includes 'Path' (or any undesired substring)
    return formattedName.includes('Pages') ? '' : formattedName;
  };

  const hexoLink = (filePath) => {
    // Find the 'pages' folder in the path and strip everything before it
    const index = filePath.indexOf('pages/');
    let adjustedPath = index !== -1 ? filePath.slice(index) : filePath;
    adjustedPath = './../' + adjustedPath; // Since this list occurs on the library.md page, we must navigate to another folder by first going back to the public/ folder.

    // If the path ends with .md, replace it with .html
    if (adjustedPath.endsWith('.md')) {
      adjustedPath = adjustedPath.replace(/\.md$/, '.html');
    }

    return adjustedPath;
  }

  // Recursive function to build nested HTML lists
  const buildNestedList = (directoryPath, layer) => {
    let html = '';

    // Read contents of the current directory
    const items = fs.readdirSync(directoryPath);

    // Separate files and directories
    const markdownFiles = items.filter(item => item.endsWith('.md'));
    const subdirectories = items.filter(item => {
      const itemPath = path.join(directoryPath, item);
      return fs.statSync(itemPath).isDirectory();
    });

    if (subdirectories.length == 0 && markdownFiles.length == 1) // Collapse Scenario B
    {
      //console.log("Collapse " + directoryPath + " Layer " + layer);
      const file = markdownFiles[0];
      const filePath = path.join(directoryPath, file);
      const title = path.basename(directoryPath).replace(/-/g, ' ');  // Converts hyphens to spaces for readability
      const dateText = dateFromFrontmatter(filePath);

      // Construct HTML elements. See partials title.ejs and date.ejs.
      html += `<li class="post-item collapse-folder">
               <div class="meta">${dateText}</div>
               <div><a href="${hexoLink(filePath)}">${title}</a></div>
             </li>`;
    }
    else if (subdirectories.length == 0 && markdownFiles.length > 1) // List All Scenario C
    {
      layer++;
      //console.log("List All " + directoryPath + " Layer " + layer);
      // Add <h2> tag header based on parent folder name
      html += '<div style="margin-left: 10px;">' + '<h2>' + parentFolderName(directoryPath) + '</h2>';
      html += processMarkdown(markdownFiles, directoryPath, layer) + "</div>";
    }
    else if (subdirectories.length > 0 && markdownFiles.length == 0) // Pass Along Scenario D
    {
      layer++;
      //console.log("Pass Along " + directoryPath + " Layer " + layer);
      // Add <h2> tag header based on parent folder name
      const result = processSubdirectories(subdirectories, directoryPath, layer);

      if (result.length > 1) // In the case that we pass along recursively, but there are no files deeper down, we instead do not create a header.
      {
        html += '<h2>' + parentFolderName(directoryPath) + '</h2>';
        html += result;
      }
    }
    else if (subdirectories.length > 0 && markdownFiles.length > 0) // Full Recursion Scenario I (i.e. Pass Along + List All)
    {
      layer++;
      // Add <h2> tag header based on parent folder name
      html += '<h2>' + parentFolderName(directoryPath) + '</h2>';
      //console.log("Full Recursion " + directoryPath + " Layer " + layer);
      html += processMarkdown(markdownFiles, directoryPath, layer);
      html += processSubdirectories(subdirectories, directoryPath, layer);
    }
    else {
      console.debug("themes/cactus/page_list.js: Else condition reached! No suitable format at " + directoryPath);
    }

    return html;
  };

  // Start building from the base directory
  return buildNestedList(baseDir, -1);
});