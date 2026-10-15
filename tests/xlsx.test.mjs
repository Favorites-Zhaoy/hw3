import {test} from 'node:test';
import assert from 'node:assert/strict';
import readXlsxFile,{readSheetNames} from 'read-excel-file/node';
import {exampleWorkbook} from '../scripts/example-workbook.mjs';
import {sheetRows,parseCSV} from '../src/data/dataset.mjs';
test('real XLSX parser lists and loads two sheets with distinct schemas',async()=>{
 const buffer=exampleWorkbook();assert.deepEqual(await readSheetNames(buffer),['Orders','Customers']);
 const orders=sheetRows(await readXlsxFile(buffer,{sheet:'Orders'})),customers=sheetRows(await readXlsxFile(buffer,{sheet:'Customers'}));
 assert.equal(orders.length,3);assert.equal(orders[0].order_id,'001');assert.equal(orders[2].amount,0);assert.equal(customers.length,2);assert.equal(customers[0].region,'East');
});
test('headerless CSV preserves a numeric first row, including repeated values',()=>{const parsed=parseCSV('1,1\n2,3',',',[],false);assert.deepEqual(parsed.columns,['column_1','column_2']);assert.deepEqual(parsed.raw,[{column_1:'1',column_2:'1'},{column_1:'2',column_2:'3'}]);});
