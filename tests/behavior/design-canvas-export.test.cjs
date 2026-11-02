const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
const root=path.resolve(__dirname,'../..');
const pixel='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';
const imageElement={id:'image-1',type:'image',x:10,y:20,width:40,height:50,content:pixel};
function fixture({elements=[imageElement],imageFails=false,tainted=false}={}){
 const calls={images:[],draw:[],downloads:[],errors:[],success:[],text:[],shape:0};
 class BrowserImage {
  constructor(){this.naturalWidth=imageFails?0:1;calls.images.push(this);}
  set src(value){assert.equal(value,pixel,'The fixture only accepts its embedded image.');queueMicrotask(()=>imageFails?this.onerror?.():this.onload?.());}
 }
 const ctx={save(){},restore(){},fillRect(){calls.shape++;},beginPath(){},roundRect(){},ellipse(){},fill(){},
  fillText(...args){calls.text.push(args);},drawImage(...args){calls.draw.push(args);}};
 const document={createElement(name){
  if(name==='canvas')return {getContext:type=>{assert.equal(type,'2d');return ctx;},toDataURL:type=>{assert.equal(type,'image/png');if(tainted)throw Error('Tainted canvas');return pixel;}};
  if(name==='a')return {click(){calls.downloads.push({name:this.download,href:this.href});}};
  throw Error('Unexpected DOM creation: '+name);
 }};
 let stateIndex=0;
 const react={useRef:value=>({current:value}),useCallback:fn=>fn,useState(value){const index=stateIndex++;
  if(index===1){assert.ok(Array.isArray(value));return [elements,()=>{}];}
  return [value,()=>{}];
 }};
 const jsx=(type,props)=>({type,props:props||{}});
 const icons=new Proxy({},{get(_target,name){return String(name);}});
 const mocks={react,'react/jsx-runtime':{jsx,jsxs:jsx,Fragment:'Fragment'},'lucide-react':icons,
  '@/hooks/useKeyboardShortcuts':{useKeyboardShortcuts(){}},
  '@/components/PageLayout':{default:'PageLayout'},'@/components/SocialPublish':{SocialPublish:'SocialPublish'},
  '@/lib/trpc':{trpc:{generation:{create:{useMutation(){return {isPending:false,mutate(){throw Error('Generation must not run in an export check.');}};}}}}},
  '@/_core/hooks/useAuth':{useAuth:()=>({user:{id:'fixture'}})},
  '@/hooks/useGenerationRequestIdentity':{useGenerationRequestIdentity:()=>({settled(){},receive(){},uncertain(){},canSubmit:true})},
  sonner:{toast:{success:v=>calls.success.push(v),error:v=>calls.errors.push(v),info(){}}},
  'framer-motion':{motion:{div:'div'}}};
 const source=fs.readFileSync(path.join(root,'client/src/pages/DesignCanvas.tsx'),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const mod={exports:{}};
 vm.runInNewContext(code,{module:mod,exports:mod.exports,require(name){
  if(Object.hasOwn(mocks,name))return mocks[name];
  if(name.startsWith('@/components/ui/'))return new Proxy({__esModule:true},{get:(o,k)=>o[k]??String(k)});
  throw Error('Unexpected component dependency: '+name);
 },window:{Image:BrowserImage},document,queueMicrotask,console,Math,Date,Promise,fetch(){throw Error('Network is forbidden.');}});
 const tree=mod.exports.default();
 function walk(node){if(Array.isArray(node))return node.flatMap(walk);if(!node||typeof node!=='object')return [];return [node,...walk(node.props?.children)];}
 const exportButton=walk(tree).find(n=>n.props?.onClick&&String(JSON.stringify(n.props.children)).includes(' Export'));
 assert.ok(exportButton,'The actual canvas must expose its PNG export action.');
 return {calls,async export(){await exportButton.props.onClick();for(let i=0;i<5;i++)await Promise.resolve();}};
}
test('an image-bearing canvas uses the browser image loader and downloads PNG',async()=>{
 const f=fixture();await f.export();assert.equal(f.calls.errors.length,0);assert.equal(f.calls.images.length,1);
 assert.equal(f.calls.images[0].crossOrigin,'anonymous');assert.equal(f.calls.draw.length,1);
 assert.deepEqual(f.calls.draw[0].slice(1),[10,20,40,50]);assert.equal(f.calls.downloads.length,1);
 assert.equal(f.calls.downloads[0].name,'dreamforgex-canvas.png');
 assert.deepEqual([...Buffer.from(f.calls.downloads[0].href.split(',')[1],'base64').subarray(0,8)],[137,80,78,71,13,10,26,10]);
 assert.ok(f.calls.success.includes('PNG exported'));
});
test('text and shape export do not require image loading',async()=>{
 const f=fixture({elements:[{id:'text',type:'text',content:'Hello',x:1,y:2,width:50,height:20},{id:'shape',type:'shape',content:'rectangle',x:5,y:6,width:10,height:10}]});
 await f.export();assert.equal(f.calls.errors.length,0);assert.equal(f.calls.images.length,0);assert.equal(f.calls.text[0][0],'Hello');assert.equal(f.calls.downloads.length,1);
});
test('a failed source image prevents a misleading successful download',async()=>{
 const f=fixture({imageFails:true});await f.export();assert.equal(f.calls.downloads.length,0);assert.equal(f.calls.success.length,0);assert.equal(f.calls.errors.length,1);
});
test('canvas encoding denial reports failure without downloading',async()=>{
 const f=fixture({tainted:true});await f.export();assert.equal(f.calls.downloads.length,0);assert.equal(f.calls.success.length,0);assert.equal(f.calls.errors.length,1);
});
