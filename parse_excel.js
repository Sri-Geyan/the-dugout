const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(process.cwd(), 'IPL_2026_Auction_Dataset_Fixed.xlsx');
console.log('Reading file:', filePath);
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

console.log('Column Names:', data[0]);
console.log('First 3 Rows of Data:');
console.log(JSON.stringify(data.slice(1, 4), null, 2));

const fullData = XLSX.utils.sheet_to_json(worksheet);
console.log('\nTotal Players:', fullData.length);
console.log('Sample Player Object:', JSON.stringify(fullData[0], null, 2));
