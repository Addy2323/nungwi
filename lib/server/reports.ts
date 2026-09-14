import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { all, now } from './db'
import { permit, staff, type Actor } from './auth'
import { listOrders, orderDetails } from './orders'
import { commissionsFor } from './platform'

export function reportRows(actor:Actor,type:string,from:string,to:string,orderId?:string):{title:string;headers:string[];rows:(string|number)[][]} {
  if(type==='receipt'&&orderId) {const order=orderDetails(actor,orderId);return {title:`Receipt ${order.number} - ${order.payment_status}`,headers:['Product','Quantity','Unit price TZS','Line total TZS'],rows:[...order.items.map(i=>[i.name,i.quantity,i.unit_price,i.quantity*i.unit_price]),['Subtotal','','',order.subtotal],['Discount','','',-order.discount],['Delivery','','',order.delivery_fee],['Tax','','',order.tax],['Deposits','','',order.deposit],['Order total','','',order.total],['Net paid','','',order.paid],['Refunded','','',order.refunded],['Outstanding','','',order.outstanding]]}}
  if(type==='commissions') {permit(actor,['admin','hotel_manager']);const rows=commissionsFor(actor).filter(c=>c.created_at>=from&&c.created_at<to);return {title:'Hotel commission statement',headers:['Order','Eligible sales','Expected','Earned','Paid','Balance'],rows:[...rows.map(c=>[c.number,c.eligible,c.expected,c.earned,c.paid,c.earned-c.paid]),['TOTAL',...['eligible','expected','earned','paid'].map(key=>rows.reduce((s,r)=>s+r[key],0)),rows.reduce((s,r)=>s+r.earned-r.paid,0)]]}}
  if(['sales','outstanding','deliveries','statement'].includes(type)) {const orders=listOrders(actor,from,to).filter(o=>type!=='outstanding'||o.outstanding>0&&!['Cancelled','Returned'].includes(o.status)).filter(o=>type!=='sales'||!['Cancelled','Returned'].includes(o.status));return {title:`${type[0].toUpperCase()+type.slice(1)} report`,headers:['Order','Date','Delivery status','Total TZS','Net paid TZS','Due TZS'],rows:[...orders.map(o=>[o.number,o.created_at.slice(0,10),o.status,o.total,o.paid,o.outstanding]),['TOTAL','','',...['total','paid','outstanding'].map(key=>orders.reduce((s,o)=>s+o[key],0))]]}}
  permit(actor,type==='products'?['admin','sales']:['admin','stock'])
  if(type==='stock'||type==='expiry') return {title:type==='expiry'?'Expiry losses':'Stock movements',headers:['Product','Movement','Base units','Unit cost','Date','Reason'],rows:all(`SELECT m.*,p.name FROM stock_movements m JOIN products p ON p.id=m.product_id WHERE m.created_at>=? AND m.created_at<? ${type==='expiry'?"AND kind='expired'":''} ORDER BY m.created_at`,from,to).map(m=>[m.name,m.kind,m.quantity,m.cost,m.created_at.slice(0,10),m.reason])}
  const orders=listOrders(actor,from,to).filter(o=>!['Cancelled','Returned'].includes(o.status));const products:Record<string,{name:string;quantity:number;sales:number}>={};orders.forEach(o=>o.items.forEach(i=>{const p=products[i.product_id]||(products[i.product_id]={name:i.name,quantity:0,sales:0});p.quantity+=i.quantity;p.sales+=i.quantity*i.unit_price}))
  return {title:'Product performance (before order discounts)',headers:['Product','Selling units','Gross product sales TZS'],rows:[...Object.values(products).map(p=>[p.name,p.quantity,p.sales]),['TOTAL',Object.values(products).reduce((s,p)=>s+p.quantity,0),Object.values(products).reduce((s,p)=>s+p.sales,0)]]}
}
export function csvReport(report:ReturnType<typeof reportRows>) {return '\uFEFF'+[report.headers,...report.rows].map(row=>row.map(value=>{let text=String(value);if(typeof value==='string'&&/^[=+@\-\t\r]/.test(text))text=`'${text}`;return `"${text.replaceAll('"','""')}"`}).join(',')).join('\r\n')}
export async function pdfReport(report:ReturnType<typeof reportRows>,period:string) {
  const pdf=await PDFDocument.create();const font=await pdf.embedFont(StandardFonts.Helvetica);const bold=await pdf.embedFont(StandardFonts.HelveticaBold)
  let page=pdf.addPage([842,595]);let y=0;let number=0
  const safe=(value:unknown)=>String(value).replace(/[^\x20-\x7E\n]/g,' ')
  const header=()=>{number++;page.drawCircle({x:38,y:553,size:15,color:rgb(1,.33,0)});page.drawText('N',{x:32,y:547,font:bold,size:15,color:rgb(1,1,1)});page.drawText('NUNGWI SHOP',{x:62,y:547,font:bold,size:20});page.drawText(safe(report.title),{x:30,y:516,font:bold,size:15});page.drawText(safe(`Period: ${period} | Generated: ${now().slice(0,16)} UTC | Page ${number}`),{x:30,y:497,font,size:9,color:rgb(.4,.4,.4)});y=473;drawRow(report.headers,true);page.drawText('Nungwi, Zanzibar  |  Beach life, delivered.  |  All amounts in TZS',{x:30,y:20,font,size:9,color:rgb(.5,.5,.5)})}
  const widths=report.headers.map((_,i)=>i===0?215:(782-215)/(report.headers.length-1||1))
  const drawRow=(row:(string|number)[],heading=false)=>{let x=30;if(heading)page.drawRectangle({x:30,y:y-5,width:782,height:20,color:rgb(1,.93,.87)});row.forEach((value,i)=>{const size=heading?8:9;const limit=Math.floor(widths[i]/(size*.55))-2;page.drawText(safe(value).slice(0,limit),{x:x+3,y,font:heading?bold:font,size});x+=widths[i]});y-=23}
  header();report.rows.forEach(row=>{if(y<60){page=pdf.addPage([842,595]);header()}drawRow(row)})
  if(!report.rows.length)drawRow(['No records in this period.'])
  return pdf.save()
}
