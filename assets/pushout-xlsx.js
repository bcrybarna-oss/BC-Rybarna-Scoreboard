/* Small, dependency-free OOXML serializer for the three-sheet Pushout export.
 * Values only: strings are inlineStr (never formulas), numbers retain numeric types.
 * ZIP method 0 avoids a network library, async compression or platform dependency. */
(function(root){
  'use strict';
  const encoder=new TextEncoder();
  const xml=s=>String(s??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
  const bytes=s=>encoder.encode(s),join=parts=>{const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let at=0;for(const p of parts){out.set(p,at);at+=p.length;}return out;};
  const table=Array.from({length:256},(_,i)=>{let c=i;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
  function crc32(data){let c=0xffffffff;for(const b of data)c=table[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
  function zip(files){
    const chunks=[],directory=[];let offset=0;
    for(const [name,text]of Object.entries(files)){
      const n=bytes(name),data=bytes(text),crc=crc32(data),header=new Uint8Array(30),h=new DataView(header.buffer);
      h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x800,true);h.setUint16(12,33,true);h.setUint32(14,crc,true);h.setUint32(18,data.length,true);h.setUint32(22,data.length,true);h.setUint16(26,n.length,true);
      chunks.push(header,n,data);
      const entry=new Uint8Array(46),e=new DataView(entry.buffer);e.setUint32(0,0x02014b50,true);e.setUint16(4,20,true);e.setUint16(6,20,true);e.setUint16(8,0x800,true);e.setUint16(14,33,true);e.setUint32(16,crc,true);e.setUint32(20,data.length,true);e.setUint32(24,data.length,true);e.setUint16(28,n.length,true);e.setUint32(42,offset,true);directory.push(entry,n);offset+=header.length+n.length+data.length;
    }
    const central=join(directory),end=new Uint8Array(22),e=new DataView(end.buffer);e.setUint32(0,0x06054b50,true);e.setUint16(8,Object.keys(files).length,true);e.setUint16(10,Object.keys(files).length,true);e.setUint32(12,central.length,true);e.setUint32(16,offset,true);return join([...chunks,central,end]);
  }
  const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const declaration='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  function sheetXml(sheet){
    const ncol=sheet.widths.length;
    const col=i=>{let v='';for(i++;i;i=Math.floor((i-1)/26))v=String.fromCharCode(65+(i-1)%26)+v;return v;};
    const rows=sheet.rows.map((row,r)=>'<row r="'+(r+1)+'" ht="'+(r===0?32:sheet.name==='Data notes'&&r>2?60:28)+'" customHeight="1">'+row.map((cell,c)=>{
      const value=cell&&typeof cell==='object'?cell.value:cell,style=cell&&typeof cell==='object'?cell.style:0,ref=col(c)+(r+1);
      return typeof value==='number'&&Number.isFinite(value)?'<c r="'+ref+'" s="'+style+'" t="n"><v>'+value+'</v></c>':'<c r="'+ref+'" s="'+style+'" t="inlineStr"><is><t xml:space="preserve">'+xml(String(value??'').slice(0,32767))+'</t></is></c>';
    }).join('')+'</row>').join('');
    const merges=(sheet.merges||[]).map(r=>'<mergeCell ref="'+xml(r)+'"/>').join('');
    return declaration+'<worksheet xmlns="'+ns+'"><dimension ref="A1:'+col(ncol-1)+sheet.rows.length+'"/><sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="'+sheet.freeze+'" topLeftCell="A'+(sheet.freeze+1)+'" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>'+sheet.widths.map((w,c)=>'<col min="'+(c+1)+'" max="'+(c+1)+'" width="'+w+'" customWidth="1"/>').join('')+'</cols><sheetData>'+rows+'</sheetData>'+(merges?'<mergeCells count="'+sheet.merges.length+'">'+merges+'</mergeCells>':'')+'<pageMargins left="0.25" right="0.25" top="0.4" bottom="0.4" header="0.2" footer="0.2"/><pageSetup orientation="landscape" paperSize="9" fitToWidth="1" fitToHeight="0"/></worksheet>';
  }
  function write(model){
    if(!Array.isArray(model.sheets)||model.sheets.length!==3||model.sheets.map(s=>s.name).join('|')!=='Pushout|Metadata|Data notes')throw Error('Invalid Pushout workbook');
    const files={};
    files['[Content_Types].xml']=declaration+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'+model.sheets.map((s,i)=>'<Override PartName="/xl/worksheets/sheet'+(i+1)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('')+'</Types>';
    files['_rels/.rels']=declaration+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
    files['xl/workbook.xml']=declaration+'<workbook xmlns="'+ns+'" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'+model.sheets.map((s,i)=>'<sheet name="'+xml(s.name)+'" sheetId="'+(i+1)+'" r:id="rId'+(i+1)+'"/>').join('')+'</sheets><calcPr calcId="191029"/></workbook>';
    files['xl/_rels/workbook.xml.rels']=declaration+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+model.sheets.map((s,i)=>'<Relationship Id="rId'+(i+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet'+(i+1)+'.xml"/>').join('')+'<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';
    files['xl/styles.xml']=declaration+'<styleSheet xmlns="'+ns+'"><fonts count="3"><font><sz val="12"/><name val="Calibri"/><color rgb="FF202020"/></font><font><b/><sz val="12"/><name val="Calibri"/><color rgb="FFFFFFFF"/></font><font><b/><sz val="18"/><name val="Calibri"/><color rgb="FFF1CE76"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF17212B"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF1F4F7"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="6"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1"><alignment vertical="center"/></xf><xf numFmtId="1" fontId="0" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyFill="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="9" fontId="0" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyFill="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyFill="1"><alignment vertical="center" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
    model.sheets.forEach((s,i)=>files['xl/worksheets/sheet'+(i+1)+'.xml']=sheetXml(s));
    return zip(files);
  }
  const api=Object.freeze({write,mime:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  if(typeof module==='object'&&module.exports)module.exports=api;else root.PushoutXlsx=api;
})(typeof window==='object'?window:globalThis);
