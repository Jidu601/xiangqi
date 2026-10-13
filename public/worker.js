import {choose} from './ai.js';
self.onmessage=({data})=>{try{self.postMessage({id:data.id,...choose(data.state,data.difficulty)});}catch(e){self.postMessage({id:data.id,error:e.message});}};
