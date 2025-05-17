/*
  This custom tag will render two texts, usually poems, side by side in a table, used
  for displaying two texts of different languages next to each other. The syntax is:

  {% bilingual %}      <-- Initiate bilingual tag.
  Language Name 1      <-- The first line of each section will be highlighted and used as a column header. Intended for the name of the language, e.g. "Irish", or "English".
  Language text....    <-- Text in the first language.
  -&-                  <-- This delimiter indicates where one language stops and another will start.
  Language Name 2
  Language text....
  {% endbilingual %}   <-- End bilingual tag.

*/
hexo.extend.tag.register('bilingual', function(args, content) {

  // Parse the parameters
  const params = {};
  args.forEach(arg => {
    const [key, value] = arg.split('=');
    if (key && value) {
      params[key.trim()] = value.trim();
    }
  });
  
  const color = params.color || 'rgb(201, 202, 204)';

  const paragraphDelimiter = '-^-';
  const generalDemiliter = '-&-';

  // Manually create emphasis and italicization in the content text
  content = content.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\*(.*?)\*/g, '<i>$1</i>');

  // Split the content into two parts using the delimiter '-&-'
  const parts = content.split(generalDemiliter);
  if (parts.length !== 2) {
    return 'Invalid content format. Please separate the two blocks of text with "' + generalDemiliter + '".';
  }

  const text1 = parts[0].trim();
  const text2 = parts[1].trim();

  const lines1 = text1.replace('\n\n', '\n-^-\n').split('\n').filter(line => line.trim() !== '');
  const lines2 = text2.replace('\n\n', '\n-^-\n').split('\n').filter(line => line.trim() !== '');

  const title1 = lines1[0] ? lines1.shift() : '';
  const title2 = lines2[0] ? lines2.shift() : '';

  let table = '<thead><tr><th> ' + title1 + ' </th><th> ' + title2 + ' </th></tr></thead><tbody>';

  for (let i = 0; i < Math.max(lines1.length, lines2.length); i++) {
    const line1 = lines1[i] ? lines1[i] : '';
    const line2 = lines2[i] ? lines2[i] : '';

    // Check for paragraph delimiter in text
    if (line1.includes(paragraphDelimiter) || line2.includes(paragraphDelimiter)) {
      table += '<tr><td><br></td></tr>';
    }
    else {
      table += `<tr><td> ${line1.replace(/([*_])/g, '\\$1')} </td><td> ${line2.replace(/([*_])/g, '\\$1')} </td></tr>`;
    }
  }

  table += '</tbody>';

  return `<table class="bilingual-table" style="color:${color};">${table}</table>`;
}, {ends: true});
