let attempts=0;
const deny=()=>{attempts++;throw Error('Outbound network is disabled for terminal behavioral checks.');};
globalThis.fetch=async()=>deny();
for(const name of ['node:http','node:https']){const mod=require(name);mod.request=deny;mod.get=deny;}
require('node:net').Socket.prototype.connect=deny;
require('node:net').connect=deny;
require('node:net').createConnection=deny;
require('node:tls').connect=deny;
require('node:dgram').Socket.prototype.send=deny;
require('node:module').syncBuiltinESMExports();
process.on('exit',()=>{if(attempts)process.exitCode=1;});
