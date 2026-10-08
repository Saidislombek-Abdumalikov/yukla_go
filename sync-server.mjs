import http from 'node:http';
import handler from './api/index.js';
const port=Number(process.env.PORT)||5000;
http.createServer((req,res)=>handler(req,res)).listen(port,'127.0.0.1',()=>console.log(`Local API: http://127.0.0.1:${port}`));
