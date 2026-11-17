const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
const root=path.resolve(__dirname,'../..');
const pixel='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';
const imageElement={id:'image-1',type:'image',x:10,y:20,width:40,height:50,content:pixel};
function fixture({elements=[imageElement],imageMode='load',tainted=false}={}){
 const calls={images:[],draw:[],downloads:[],errors:[],success:[],text:[],shape:0,readers:[]};
 const timers=new Map();let now=0,timerId=0;
 class BrowserImage {
  constructor(){this.naturalWidth=imageMode==='empty'?0:1;calls.images.push(this);}
  set src(value){this.source=value;if(value==='')return;assert.equal(value,pixel,'The fixture only accepts its embedded image.');
   if(imageMode!=='never')queueMicrotask(()=>imageMode==='error'?this.onerror?.():this.onload?.());}
 }
 class FileReader {constructor(){calls.readers.push(this);}readAsDataURL(file){this.file=file;}}
 const ctx={save(){},restore(){},fillRect(){calls.shape++;},beginPath(){},roundRect(){},
  ellipse(_x,_y,rx,ry){assert.ok(rx>0&&ry>0,'Negative/empty geometry must not reach browser canvas.');},fill(){},
  fillText(...args){calls.text.push(args);},drawImage(...args){calls.draw.push(args);}};
 const document={createElement(name){
  if(name==='canvas')return {getContext:type=>{assert.equal(type,'2d');return ctx;},toDataURL:type=>{assert.equal(type,'image/png');if(tainted){const e=Error('Tainted canvas');e.name='SecurityError';throw e;}return pixel;}};
  if(name==='a')return {click(){calls.downloads.push({name:this.download,href:this.href});}};
  throw Error('Unexpected DOM creation: '+name);
 }};
 let stateIndex=0,refIndex=0;const states=[],refs=[];
 const react={useRef(value){const i=refIndex++;return refs[i]??(refs[i]={current:value});},useCallback:fn=>fn,
  useState(value){const i=stateIndex++;if(!(i in states))states[i]=i===1?elements:value;
   return [states[i],next=>{states[i]=typeof next==='function'?next(states[i]):next;}];}};
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
 },window:{Image:BrowserImage},document,FileReader,queueMicrotask,console,Math,Date:class extends Date {static now(){return 123;}},Promise,
 setTimeout(fn,delay){const id=++timerId;timers.set(id,{fn,at:now+delay});return id;},clearTimeout(id){timers.delete(id);},
 fetch(){throw Error('Network is forbidden.');}});
 function walk(node){if(Array.isArray(node))return node.flatMap(walk);if(!node||typeof node!=='object')return [];return [node,...walk(node.props?.children)];}
 function render(){stateIndex=0;refIndex=0;return walk(mod.exports.default());}
 function text(node){if(Array.isArray(node))return node.map(text).join('');return typeof node==='string'?node:text(node?.props?.children??[]);}
 const find=predicate=>{const node=render().find(predicate);assert.ok(node,'The actual component must expose the requested control.');return node;};
 const button=label=>find(n=>n.type==='Button'&&text(n).trim()===label);
 const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
 return {calls,find,button,render,flush,get elements(){return states[1];},get pendingTimers(){return timers.size;},
  setImageMode(mode){imageMode=mode;},
  async export(){button('Export').props.onClick();await flush();},
  async advance(ms){now+=ms;for(const [id,t] of [...timers])if(t.at<=now){timers.delete(id);t.fn();}await flush();},
  upload(){find(n=>n.type==='input'&&n.props.type==='file').props.onChange({target:{files:[{name:'fixture.png'}]}});},
  finishRead(index){const reader=calls.readers[index];reader.result=pixel;reader.onload();},
 };
}
test('an image-bearing canvas uses the browser image loader and downloads PNG',async()=>{
 const f=fixture();await f.export();assert.equal(f.calls.errors.length,0);assert.equal(f.calls.images.length,1);
 assert.equal(f.calls.images[0].crossOrigin,'anonymous');assert.equal(f.calls.draw.length,1);
 assert.deepEqual(f.calls.draw[0].slice(1),[10,20,40,50]);assert.equal(f.calls.downloads.length,1);
 assert.equal(f.calls.downloads[0].name,'dreamforgex-canvas.png');
 assert.deepEqual([...Buffer.from(f.calls.downloads[0].href.split(',')[1],'base64').subarray(0,8)],[137,80,78,71,13,10,26,10]);
 assert.ok(f.calls.success.includes('PNG exported'));assert.equal(f.pendingTimers,0);
});
test('text and shape export do not require image loading',async()=>{
 const f=fixture({elements:[{id:'text',type:'text',content:'Hello',x:1,y:2,width:50,height:20},{id:'shape',type:'shape',content:'rectangle',x:5,y:6,width:10,height:10}]});
 await f.export();assert.equal(f.calls.errors.length,0);assert.equal(f.calls.images.length,0);assert.equal(f.calls.text[0][0],'Hello');assert.equal(f.calls.downloads.length,1);
});
for(const mode of ['error','empty'])test(`a ${mode} source image prevents a misleading successful download`,async()=>{
 const f=fixture({imageMode:mode});await f.export();assert.equal(f.calls.downloads.length,0);assert.equal(f.calls.success.length,0);assert.equal(f.calls.errors.length,1);
 assert.match(f.calls.errors[0],/source image/i);assert.doesNotMatch(f.calls.errors[0],/CORS/);assert.equal(f.pendingTimers,0);
});
test('canvas encoding security denial reports CORS without downloading',async()=>{
 const f=fixture({tainted:true});await f.export();assert.equal(f.calls.downloads.length,0);assert.equal(f.calls.success.length,0);assert.match(f.calls.errors[0],/CORS/);
});
test('a never-settling image times out, releases export, ignores late completion and permits retry',async()=>{
 const f=fixture({imageMode:'never'});await f.export();assert.equal(f.button('Export').props.disabled,true);assert.equal(f.pendingTimers,1);
 const lateLoad=f.calls.images[0].onload;await f.export();assert.equal(f.calls.images.length,1,'Concurrent export stays gated.');
 await f.advance(15_000);assert.equal(f.button('Export').props.disabled,false);assert.equal(f.calls.downloads.length,0);assert.match(f.calls.errors[0],/too long/);
 assert.equal(f.pendingTimers,0);assert.equal(f.calls.images[0].onload,null);assert.equal(f.calls.images[0].onerror,null);
 lateLoad();await f.flush();assert.equal(f.calls.downloads.length,0);f.setImageMode('load');await f.export();assert.equal(f.calls.downloads.length,1);
});
test('deferred uploads preserve intervening additions, edits, deletion and complete undo/redo states',async()=>{
 const f=fixture({elements:[]});f.upload();f.upload();f.button('Text').props.onClick();
 f.find(n=>n.props?.contentEditable).props.onBlur({currentTarget:{textContent:'Edited while loading'}});
 f.button('Circle').props.onClick();f.button('Delete').props.onClick();
 f.finishRead(1);f.finishRead(0);assert.deepEqual(Array.from(f.elements,x=>x.type),['text','image','image']);
 assert.equal(f.elements[0].content,'Edited while loading');assert.equal(new Set(f.elements.map(x=>x.id)).size,3);
 f.find(n=>n.props?.title==='Undo (Ctrl+Z)').props.onClick();assert.equal(f.elements.length,2);
 f.find(n=>n.props?.title==='Undo (Ctrl+Z)').props.onClick();assert.equal(f.elements.length,1);assert.equal(f.elements[0].content,'Edited while loading');
 f.find(n=>n.props?.title==='Redo (Ctrl+Shift+Z)').props.onClick();f.find(n=>n.props?.title==='Redo (Ctrl+Shift+Z)').props.onClick();
 await f.export();assert.equal(f.calls.text[0][0],'Edited while loading');assert.equal(f.calls.draw.length,2);
});
test('uploads append to the canvas selected through undo while reading',()=>{
 const f=fixture({elements:[]});f.button('Text').props.onClick();f.button('Circle').props.onClick();f.upload();
 f.find(n=>n.props?.title==='Undo (Ctrl+Z)').props.onClick();f.finishRead(0);
 assert.deepEqual(Array.from(f.elements,x=>x.type),['text','image']);assert.equal(f.find(n=>n.props?.title==='Redo (Ctrl+Shift+Z)').props.disabled,true);
});
test('pointer drag survives undo and redo without a later commit',()=>{
 const f=fixture({elements:[]});f.button('Circle').props.onClick();const original={...f.elements[0]};
 const listeners={};const target={setPointerCapture(){},addEventListener(name,fn){listeners[name]=fn;},removeEventListener(name){delete listeners[name];}};
 f.find(n=>n.props?.onPointerDown).props.onPointerDown({stopPropagation(){},currentTarget:target,clientX:5,clientY:7,pointerId:1});
 listeners.pointermove({clientX:25,clientY:37});listeners.pointerup();
 const moved={...f.elements[0]};assert.equal(moved.x,original.x+40);assert.equal(moved.y,original.y+60);
 f.find(n=>n.props?.title==='Undo (Ctrl+Z)').props.onClick();assert.equal(f.elements[0].x,original.x);assert.equal(f.elements[0].y,original.y);
 f.find(n=>n.props?.title==='Redo (Ctrl+Shift+Z)').props.onClick();assert.equal(f.elements[0].x,moved.x);assert.equal(f.elements[0].y,moved.y);
});
test('uncommitted text and dimension edits survive undo and redo',()=>{
 const f=fixture({elements:[]});f.button('Text').props.onClick();
 f.find(n=>n.props?.contentEditable).props.onBlur({currentTarget:{textContent:'Keep this edit'}});
 f.render().filter(n=>n.type==='Input'&&n.props.type==='number')[0].props.onChange({target:{value:'222'}});
 f.render().filter(n=>n.type==='Input'&&n.props.type==='number')[1].props.onChange({target:{value:'77'}});
 f.find(n=>n.props?.title==='Undo (Ctrl+Z)').props.onClick();assert.equal(f.elements.length,0);
 f.find(n=>n.props?.title==='Redo (Ctrl+Shift+Z)').props.onClick();assert.equal(f.elements[0].content,'Keep this edit');
 assert.equal(f.elements[0].width,222);assert.equal(f.elements[0].height,77);
});
test('width/height controls clamp invalid sizes before circle export',async()=>{
 const f=fixture({elements:[]});f.button('Circle').props.onClick();
 const change=(index,value)=>f.render().filter(n=>n.type==='Input'&&n.props.type==='number')[index].props.onChange({target:{value}});
 change(0,'-4');change(1,'0');assert.equal(f.elements[0].width,1);assert.equal(f.elements[0].height,1);
 change(0,'Infinity');change(1,'');assert.equal(f.elements[0].width,1);assert.equal(f.elements[0].height,1);
 await f.export();assert.equal(f.calls.errors.length,0);assert.equal(f.calls.downloads.length,1);
});
for(const size of [-4,0,NaN,Infinity])test(`defensive export reports invalid geometry (${size}) without claiming CORS`,async()=>{
 const f=fixture({elements:[{id:'bad-circle',type:'shape',content:'circle',x:0,y:0,width:size,height:10}]});
 await f.export();assert.equal(f.calls.downloads.length,0);assert.equal(f.calls.success.length,0);assert.match(f.calls.errors[0],/invalid size/);assert.doesNotMatch(f.calls.errors[0],/CORS/);
 assert.equal(f.button('Export').props.disabled,false);
});
