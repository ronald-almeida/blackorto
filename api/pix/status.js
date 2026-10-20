import {server} from '../../server.mjs';
export default function handler(req,res){req.url='/api/pix/status';server.emit('request',req,res);}
