import {server} from '../server.mjs';
export default function handler(req,res){req.url='/api/pix';server.emit('request',req,res);}
