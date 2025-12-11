import { Shot } from "../types";

const generateTableHtml = (shots: Shot[], title: string, isExcel = false) => {
  // Excel specific styling for text wrapping and alignment
  const excelStyles = isExcel ? `
    br { mso-data-placement:same-cell; }
    td { vertical-align: top; white-space: normal; }
  ` : '';

  let html = `
    <h1>${title} - 欢玺AI拉片表</h1>
    <table>
      <thead>
        <tr>
          <th rowspan="2" style="width: 40px;">镜号</th>
          <th rowspan="2" style="width: 50px;">时长/秒</th>
          <th rowspan="2" style="width: 120px;">画面</th>
          <th colspan="2">镜头内容</th>
          <th colspan="2">环境</th>
          <th colspan="4">相机</th>
          <th colspan="2">人物</th>
          <th rowspan="2">亮点设计</th>
          <th rowspan="2">道具作用</th>
          <th colspan="3">声音</th>
          <th rowspan="2">剪辑</th>
          <th rowspan="2">MJ 提示词</th>
        </tr>
        <tr>
          <th>内容</th>
          <th>涵义</th>
          <th>景别</th>
          <th>灯光</th>
          <th>机位</th>
          <th>视角</th>
          <th>视点</th>
          <th>虚实</th>
          <th>人物关系</th>
          <th>人物调度</th>
          <th>台词</th>
          <th>音效</th>
          <th>音乐</th>
        </tr>
      </thead>
      <tbody>
  `;

  shots.forEach(shot => {
    if (!shot.analysis) return;
    const a = shot.analysis;
    const timeDisplay = new Date(shot.timestamp * 1000).toISOString().substr(14, 5);
    
    // For Excel, we might want to strip HTML image tags if files aren't embedded, 
    // but Excel HTML usually handles linked images if they are base64 or accessible URLs.
    // Base64 in Excel HTML can be hit or miss depending on version, but we keep it for now.
    
    html += `
      <tr>
        <td>${a.shotNumber}</td>
        <td>${timeDisplay}<br/>${a.duration || '-'}</td>
        <td class="image-cell"><img src="${shot.imageUrl}" width="150" height="84" /></td>
        
        <td>${a.content?.visual || ''}</td>
        <td>${a.content?.subtext || ''}</td>
        
        <td>${a.environment?.shotSize || ''}</td>
        <td>${a.environment?.lighting || ''}</td>
        
        <td>${a.camera?.position || ''}</td>
        <td>${a.camera?.angle || ''}</td>
        <td>${a.camera?.viewpoint || ''}</td>
        <td>${a.camera?.focus || ''}</td>
        
        <td>${a.character?.relationships || ''}</td>
        <td>${a.character?.blocking || ''}</td>
        
        <td>${a.highlightDesign || ''}</td>
        <td>${a.props || ''}</td>
        
        <td>${a.sound?.dialogue || ''}</td>
        <td>${a.sound?.sfx || ''}</td>
        <td>${a.sound?.music || ''}</td>
        
        <td>${a.editing || ''}</td>
        <td style="font-size: 8pt; text-align: left;">${a.mjPrompt || ''}</td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  return { html, excelStyles };
};

export const exportToWord = (shots: Shot[], title: string) => {
  const { html } = generateTableHtml(shots, title);
  const fullHtml = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head><meta charset='utf-8'><title>${title}</title>
    <style>
      body { font-family: "SimSun", "宋体", Arial, sans-serif; font-size: 10pt; }
      table { border-collapse: collapse; width: 100%; table-layout: fixed; }
      th, td { border: 1px solid #000; padding: 4px; vertical-align: middle; text-align: center; word-wrap: break-word; }
      th { background-color: #5b9bd5; color: white; font-weight: bold; }
      .image-cell img { width: 100%; height: auto; }
    </style>
    </head><body>${html}</body></html>
  `;

  const blob = new Blob([fullHtml], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${title.replace(/\s+/g, '_')}_Analysis.doc`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportToExcel = (shots: Shot[], title: string) => {
  const { html, excelStyles } = generateTableHtml(shots, title, true);
  const fullHtml = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="UTF-8">
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>拉片表</x:Name>
              <x:WorksheetOptions>
                <x:DisplayGridlines/>
              </x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <style>
        body { font-family: "SimSun", Arial, sans-serif; }
        table { border-collapse: collapse; }
        td, th { border: 1px solid thin; padding: 5px; }
        th { background-color: #5b9bd5; color: white; }
        .text { mso-number-format:"\@"; }
        ${excelStyles}
      </style>
    </head>
    <body>${html}</body>
    </html>
  `;

  const blob = new Blob([fullHtml], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${title.replace(/\s+/g, '_')}_Analysis.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const printForPdf = () => {
  window.print();
};