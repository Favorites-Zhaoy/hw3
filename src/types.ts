export type Row = Record<string, any>;
export type Operation = {id:string;type:string;params:Record<string,any>;status:string;created_at:string;warnings:string[]};
export type Lang = 'zh'|'en';
export type Bundle = {tables:Record<string,Row[]>;manifest:Row;recipes:Row[];atlas:Row[];dictionary:Row;sources:Row};
