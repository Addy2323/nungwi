export const PRODUCT_CSV_HEADER = 'Product Name,Category,Brand,Barcode,Unit,Purchase Cost,Selling Price'
export function parseProductCsv(text:string) {
  if(text.length>75000)throw new Error('Import up to 75 KB at a time.')
  const rows:string[][]=[];let row:string[]=[];let cell='';let quoted=false
  for(let i=0;i<text.length;i++){
    const char=text[i]
    if(char==='"') {if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted}
    else if(!quoted&&char===','){row.push(cell);cell=''}
    else if(!quoted&&char==='\n'){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell=''}
    else cell+=char
  }
  if(quoted)throw new Error('An import row contains an unclosed quotation mark.')
  if(cell||row.length){row.push(cell.replace(/\r$/,''));rows.push(row)}
  if(rows.shift()?.map(v=>v.trim().replace(/^\uFEFF/,'')).join(',')!==PRODUCT_CSV_HEADER)throw new Error('Use the CSV template column headings.')
  const data=rows.filter(r=>r.some(c=>c.trim()))
  if(!data.length||data.length>100)throw new Error('Import between 1 and 100 products at a time.')
  return data.map((r,i)=>{
    if(r.length!==7)throw new Error(`Row ${i+2}: expected seven columns.`)
    return {name:r[0].trim(),category:r[1].trim(),brand:r[2].trim(),barcode:r[3].trim(),unit:r[4].trim().toLowerCase(),cost:r[5].trim()?Number(r[5]):0,price:r[6].trim()?Number(r[6]):0}
  })
}
