import{_ as ro}from"./__vite-browser-external-Ckx8KI8k.js";function ao(e,t){return t.forEach(function(n){n&&typeof n!="string"&&!Array.isArray(n)&&Object.keys(n).forEach(function(s){if(s!=="default"&&!(s in e)){var r=Object.getOwnPropertyDescriptor(n,s);Object.defineProperty(e,s,r.get?r:{enumerable:!0,get:function(){return n[s]}})}})}),Object.freeze(e)}/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */const oo=1e-7,io=1e-4;class m0{constructor(t,n){this.backend=t,this.dataMover=n,this.data=new WeakMap,this.dataIdsCount=0}get(t){return this.data.has(t)||this.dataMover.moveData(this.backend,t),this.data.get(t)}set(t,n){this.dataIdsCount++,this.data.set(t,n)}has(t){return this.data.has(t)}delete(t){return this.dataIdsCount--,this.data.delete(t)}numDataIds(){return this.dataIdsCount}}class uo{refCount(t){return yt("refCount")}incRef(t){return yt("incRef")}timerAvailable(){return!0}time(t){return yt("time")}read(t){return yt("read")}readSync(t){return yt("readSync")}readToGPU(t,n){return yt("readToGPU")}numDataIds(){return yt("numDataIds")}disposeData(t,n){return yt("disposeData")}write(t,n,s){return yt("write")}move(t,n,s,r,a){return yt("move")}memory(){return yt("memory")}floatPrecision(){return yt("floatPrecision")}epsilon(){return this.floatPrecision()===32?oo:io}dispose(){return yt("dispose")}}function yt(e){throw new Error(`'${e}' not yet implemented or not found in the registry. This kernel may not be supported by the tfjs backend you have chosen`)}/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Er(e){let t=e.length,n=0;for(;t>0;)n=Math.random()*t|0,t--,en(e,t,n)}function co(e,t){if(e.length!==t.length)throw new Error(`Array sizes must match to be shuffled together First array length was ${e.length}Second array length was ${t.length}`);let n=e.length,s=0;for(;n>0;)s=Math.random()*n|0,n--,en(e,n,s),en(t,n,s)}function lo(e,t,n){return Math.max(e,Math.min(t,n))}function po(e){return e%2===0?e:e+1}function en(e,t,n){const s=e[t];e[t]=e[n],e[n]=s}function ho(e){let t=0;for(let n=0;n<e.length;n++)t+=e[n];return t}function fo(e,t){const n=Math.random();return t*n+(1-n)*e}function mo(e,t){let n=0;for(let s=0;s<e.length;s++){const r=Number(e[s])-Number(t[s]);n+=r*r}return n}function y(e,t){if(!e)throw new Error(typeof t=="string"?t:t())}function ht(e,t,n=""){y(Ot(e,t),()=>n+` Shapes ${e} and ${t} must match`)}function ie(e){y(e!=null,()=>"The input to the tensor constructor must be a non-null value.")}function Be(e,t=[],n=!1){if(t==null&&(t=[]),Array.isArray(e)||Et(e)&&!n)for(let s=0;s<e.length;++s)Be(e[s],t,n);else t.push(e);return t}function Q(e){if(e.length===0)return 1;let t=e[0];for(let n=1;n<e.length;n++)t*=e[n];return t}function go(e){return e.length===0}function Ot(e,t){if(e===t)return!0;if(e==null||t==null||e.length!==t.length)return!1;for(let n=0;n<e.length;n++)if(e[n]!==t[n])return!1;return!0}function de(e){return e%1===0}function yo(e){if(Math.tanh!=null)return Math.tanh(e);if(e===1/0)return 1;if(e===-1/0)return-1;{const t=Math.exp(2*e);return(t-1)/(t+1)}}function bo(e){const t=Math.ceil(Math.sqrt(e));return[t,Math.ceil(e/t)]}function wo(e){const t=new Uint32Array(e);for(let n=0;n<e;++n)t[n]=n;return Er(t),t}function Ee(e,t){return t<=e.length?e:e+" ".repeat(t-e.length)}function No(e,t=r=>0,n,s=setTimeout){return new Promise((r,a)=>{let o=0;const i=()=>{if(e()){r();return}o++;const u=t(o);if(n!=null&&o>=n){a();return}s(i,u)};i()})}function To(e,t){let n=1,s=-1;for(let a=0;a<e.length;++a)if(e[a]>=0)n*=e[a];else if(e[a]===-1){if(s!==-1)throw Error(`Shapes can only have 1 implicit size. Found -1 at dim ${s} and dim ${a}`);s=a}else if(e[a]<0)throw Error(`Shapes can not be < 0. Found ${e[a]} at dim ${a}`);if(s===-1){if(t>0&&t!==n)throw Error(`Size(${t}) must match the product of shape ${e}`);return e}if(n===0)throw Error(`Cannot infer the missing size in [${e}] when there are 0 elements`);if(t%n!==0)throw Error(`The implicit shape can't be a fractional number. Got ${t} / ${n}`);const r=e.slice();return r[s]=t/n,r}function Le(e,t){const n=t.length;return e=e==null?t.map((s,r)=>r):[].concat(e),y(e.every(s=>s>=-n&&s<n),()=>`All values in axis param must be in range [-${n}, ${n}) but got axis ${e}`),y(e.every(s=>de(s)),()=>`All values in axis param must be integers but got axis ${e}`),e.map(s=>s<0?n+s:s)}function vr(e,t){const n=[],s=[],r=t!=null&&Array.isArray(t)&&t.length===0,a=t==null||r?null:Le(t,e).sort();let o=0;for(let i=0;i<e.length;++i){if(a!=null){if(a[o]===i&&e[i]!==1)throw new Error(`Can't squeeze axis ${i} since its dim '${e[i]}' is not 1`);(a[o]==null||a[o]>i)&&e[i]===1&&(n.push(e[i]),s.push(i)),a[o]<=i&&o++}e[i]!==1&&(n.push(e[i]),s.push(i))}return{newShape:n,keptDims:s}}function _r(e,t){let n=null;if(e==null||e==="float32")n=new Float32Array(t);else if(e==="int32")n=new Int32Array(t);else if(e==="bool")n=new Uint8Array(t);else throw new Error(`Unknown data type ${e}`);return n}function xr(e,t){let n=null;if(e==null||e==="float32")n=new Float32Array(t);else if(e==="int32")n=new Int32Array(t);else if(e==="bool")n=new Uint8Array(t);else if(e==="string")n=new Array(t);else throw new Error(`Unknown data type ${e}`);return n}function Ir(e,t){for(let n=0;n<e.length;n++){const s=e[n];if(isNaN(s)||!isFinite(s))throw Error(`A tensor of type ${t} being uploaded contains ${s}.`)}}function Ar(e){return e==="bool"||e==="complex64"||e==="float32"||e==="int32"||e==="string"}function So(e,t){return!(t==="complex64"||t==="float32"&&e!=="complex64"||t==="int32"&&e!=="float32"&&e!=="complex64"||t==="bool"&&e==="bool")}function Et(e){return e instanceof Float32Array||e instanceof Int32Array||e instanceof Uint8Array||e instanceof Uint8ClampedArray}function Pn(e){if(e==="float32"||e==="int32")return 4;if(e==="complex64")return 8;if(e==="bool")return 1;throw new Error(`Unknown dtype ${e}`)}function Dr(e){if(e==null)return 0;let t=0;return e.forEach(n=>t+=n.length),t}function fn(e){return typeof e=="string"||e instanceof String}function Or(e){return typeof e=="boolean"}function Fr(e){return typeof e=="number"}function mn(e){return Array.isArray(e)?mn(e[0]):e instanceof Float32Array?"float32":e instanceof Int32Array||e instanceof Uint8Array||e instanceof Uint8ClampedArray?"int32":Fr(e)?"float32":fn(e)?"string":Or(e)?"bool":"float32"}function qt(e){return!!(e&&e.constructor&&e.call&&e.apply)}function $o(e,t){for(let n=t;n<e;++n)if(e%n===0)return n;return e}function Pe(e){const t=e.length;if(t<2)return[];const n=new Array(t-1);n[t-2]=e[t-1];for(let s=t-3;s>=0;--s)n[s]=n[s+1]*e[s+1];return n}function Cr(e,t,n,s=!1){const r=new Array;if(t.length===1){const a=t[0]*(s?2:1);for(let o=0;o<a;o++)r[o]=n[e+o]}else{const a=t[0],o=t.slice(1),i=o.reduce((u,c)=>u*c)*(s?2:1);for(let u=0;u<a;u++)r[u]=Cr(e+u*i,o,n,s)}return r}function Zt(e,t,n=!1){if(e.length===0)return t[0];const s=e.reduce((r,a)=>r*a)*(n?2:1);if(s===0)return[];if(s!==t.length)throw new Error(`[${e}] does not match the input size ${t.length}${n?" for a complex tensor":""}.`);return Cr(0,e,t,n)}function ms(e,t){const n=dn(e,t);for(let s=0;s<n.length;s++)n[s]=1;return n}function dn(e,t){if(t==null||t==="float32"||t==="complex64")return new Float32Array(e);if(t==="int32")return new Int32Array(e);if(t==="bool")return new Uint8Array(e);throw new Error(`Unknown data type ${t}`)}function ko(e,t){const n=e.reduce((s,r)=>s*r,1);if(t==null||t==="float32")return Zt(e,new Float32Array(n));if(t==="int32")return Zt(e,new Int32Array(n));if(t==="bool")return Zt(e,new Uint8Array(n));throw new Error(`Unknown data type ${t}`)}function ds(e){e.forEach(t=>{y(Number.isInteger(t)&&t>=0,()=>`Tensor must have a shape comprised of positive integers but got shape [${e}].`)})}function Eo(e,t,n){if(t===0)return 0;if(t===1)return e[0];let s=e[e.length-1];for(let r=0;r<e.length-1;++r)s+=n[r]*e[r];return s}function vo(e,t,n){if(t===0)return[];if(t===1)return[e];const s=new Array(t);for(let r=0;r<s.length-1;++r)s[r]=Math.floor(e/n[r]),e-=s[r]*n[r];return s[s.length-1]=e,s}function te(e){return e&&e.then&&typeof e.then=="function"}/**
 * @license
 * Copyright 2017 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */const Ks="tfjsflags";class _o{constructor(t){this.global=t,this.flags={},this.flagRegistry={},this.urlFlags={},this.getQueryParams=xo,this.populateURLFlags()}setPlatform(t,n){this.platform!=null&&(R().getBool("IS_TEST")||R().getBool("PROD")||console.warn(`Platform ${this.platformName} has already been set. Overwriting the platform with ${t}.`)),this.platformName=t,this.platform=n}registerFlag(t,n,s){if(this.flagRegistry[t]={evaluationFn:n,setHook:s},this.urlFlags[t]!=null){const r=this.urlFlags[t];R().getBool("IS_TEST")||R().getBool("PROD")||console.warn(`Setting feature override from URL ${t}: ${r}.`),this.set(t,r)}}async getAsync(t){return t in this.flags?this.flags[t]:(this.flags[t]=await this.evaluateFlag(t),this.flags[t])}get(t){if(t in this.flags)return this.flags[t];const n=this.evaluateFlag(t);if(te(n))throw new Error(`Flag ${t} cannot be synchronously evaluated. Please use getAsync() instead.`);return this.flags[t]=n,this.flags[t]}getNumber(t){return this.get(t)}getBool(t){return this.get(t)}getFlags(){return this.flags}get features(){return this.flags}set(t,n){if(this.flagRegistry[t]==null)throw new Error(`Cannot set flag ${t} as it has not been registered.`);this.flags[t]=n,this.flagRegistry[t].setHook!=null&&this.flagRegistry[t].setHook(n)}evaluateFlag(t){if(this.flagRegistry[t]==null)throw new Error(`Cannot evaluate flag '${t}': no evaluation function found.`);return this.flagRegistry[t].evaluationFn()}setFlags(t){this.flags=Object.assign({},t)}reset(){this.flags={},this.urlFlags={},this.populateURLFlags()}populateURLFlags(){if(typeof this.global>"u"||typeof this.global.location>"u"||typeof this.global.location.search>"u")return;const t=this.getQueryParams(this.global.location.search);Ks in t&&t[Ks].split(",").forEach(s=>{const[r,a]=s.split(":");this.urlFlags[r]=Ao(r,a)})}}function xo(e){const t={};return e.replace(/[?&]([^=?&]+)(?:=([^&]*))?/g,(n,...s)=>(Io(t,s[0],s[1]),s.join("="))),t}function Io(e,t,n){e[decodeURIComponent(t)]=decodeURIComponent(n||"")}function Ao(e,t){if(t=t.toLowerCase(),t==="true"||t==="false")return t==="true";if(`${+t}`===t)return+t;throw new Error(`Could not parse value flag value ${t} for flag ${e}.`)}function R(){return Br}let Br=null;function Do(e){Br=e}/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */let xn;function Lr(){if(xn==null){let e;if(typeof window<"u")e=window;else if(typeof global<"u")e=global;else if(typeof process<"u")e=process;else if(typeof self<"u")e=self;else throw new Error("Could not find a global object");xn=e}return xn}function Oo(){const e=Lr();return e._tfGlobals==null&&(e._tfGlobals=new Map),e._tfGlobals}function gs(e,t){const n=Oo();if(n.has(e))return n.get(e);{const s=t();return n.set(e,s),n.get(e)}}const Fo="Abs",Co="Acos",Bo="Acosh",Pr="Add",Lo="AddN",Po="All",Ro="Any",zo="ArgMax",Vo="ArgMin",qo="Asin",Uo="Asinh",Wo="Atan",jo="Atanh",Ko="Atan2",Ho="AvgPool",d0="AvgPoolGrad",Go="AvgPool3D",g0="AvgPool3DGrad",Mo="BatchMatMul",Xo="BatchToSpaceND",Yo="Bincount",y0="BroadcastTo",Jo="BroadcastArgs",Rr="Cast",Zo="Ceil",Qo="ClipByValue",ti="Complex",ei="ComplexAbs",ni="Concat",si="Conv2D",ri="Conv2DBackpropFilter",ai="Conv2DBackpropInput",oi="Conv3D",b0="Conv3DBackpropFilterV2",ii="Conv3DBackpropInputV2",ui="Cos",ci="Cosh",li="Cumprod",pi="Cumsum",hi="CropAndResize",fi="DenseBincount",mi="DepthToSpace",di="DepthwiseConv2dNative",gi="DepthwiseConv2dNativeBackpropFilter",yi="DepthwiseConv2dNativeBackpropInput",bi="Diag",wi="Dilation2D",w0="Dilation2DBackpropInput",N0="Dilation2DBackpropFilter",Ni="RealDiv",Ti="Einsum",Si="Elu",T0="EluGrad",$i="Erf",ki="Equal",Ei="Exp",vi="ExpandDims",_i="Expm1",xi="FFT",Ii="Fill",Ai="FlipLeftRight",Di="Floor",Oi="FloorDiv",Fi="FusedBatchNorm",Ci="GatherV2",Bi="GatherNd",Li="Greater",Pi="GreaterEqual",zr="Identity",Ri="IFFT",zi="Imag",Vi="IsFinite",qi="IsInf",Ui="IsNan",Wi="LeakyRelu",ji="Less",Ki="LessEqual",Hi="LinSpace",Gi="Log",Mi="Log1p",Xi="LogicalAnd",Yi="LogicalNot",Ji="LogicalOr",S0="LogicalXor",$0="LogSoftmax",k0="LowerBound",Zi="LRN",E0="LRNGrad",Qi="Max",tu="Maximum",eu="MaxPool",v0="MaxPoolGrad",nu="MaxPool3D",_0="MaxPool3DGrad",su="MaxPoolWithArgmax",ru="Mean",au="Min",ou="Minimum",iu="MirrorPad",uu="Mod",cu="Multinomial",lu="Multiply",pu="Neg",hu="NotEqual",fu="NonMaxSuppressionV3",mu="NonMaxSuppressionV4",du="NonMaxSuppressionV5",gu="OnesLike",yu="OneHot",bu="Pack",wu="PadV2",x0="Pool",Nu="Pow",Tu="Prelu",Su="Prod",$u="RaggedGather",ku="RaggedTensorToTensor",Eu="Range",vu="Real",_u="Reciprocal",xu="Relu",Iu="Reshape",Au="ResizeNearestNeighbor",I0="ResizeNearestNeighborGrad",Du="ResizeBilinear",A0="ResizeBilinearGrad",Ou="Relu6",Fu="Reverse",Cu="Round",Bu="Rsqrt",Lu="ScatterNd",Pu="SearchSorted",Ru="Select",zu="Selu",Vu="Slice",qu="Sin",Uu="Sinh",Wu="Sign",ju="Sigmoid",Ku="Softplus",Hu="Sqrt",Gu="Sum",Mu="SpaceToBatchND",Xu="SplitV",Yu="Softmax",Ju="SparseFillEmptyRows",Zu="SparseReshape",Qu="SparseSegmentMean",tc="SparseSegmentSum",ec="SparseToDense",nc="SquaredDifference",D0="Square",sc="StridedSlice",rc="StringNGrams",ac="StringSplit",oc="StringToHashBucketFast",ic="Sub",uc="Tan",cc="Tanh",Vr="Tile",lc="TopK",pc="Transform",In="Transpose",hc="Unique",fc="Unpack",mc="UnsortedSegmentSum",O0="UpperBound",dc="ZerosLike",gc="Step",F0="FromPixels",yc="RotateWithOffset",Hs="_FusedMatMul",Gs="FusedConv2D",Ms="FusedDepthwiseConv2D";/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Mt(...e){R().getBool("IS_TEST")||R().getBool("PROD")||console.warn(...e)}function C0(...e){R().getBool("IS_TEST")||R().getBool("PROD")||console.log(...e)}/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */const ge=gs("kernelRegistry",()=>new Map),xe=gs("gradRegistry",()=>new Map);function Xs(e,t){const n=ys(e,t);return ge.get(n)}function Ys(e){return xe.get(e)}function Rn(e){const t=ge.entries(),n=[];for(;;){const{done:s,value:r}=t.next();if(s)break;const[a,o]=r,[i]=a.split("_");i===e&&n.push(o)}return n}function bc(e){const{kernelName:t,backendName:n}=e,s=ys(t,n);ge.has(s)&&Mt(`The kernel '${t}' for backend '${n}' is already registered`),ge.set(s,e)}function B0(e){const{kernelName:t}=e;xe.has(t)&&R().getBool("DEBUG")&&Mt(`Overriding the gradient for '${t}'`),xe.set(t,e)}function L0(e,t){const n=ys(e,t);if(!ge.has(n))throw new Error(`The kernel '${e}' for backend '${t}' is not registered`);ge.delete(n)}function P0(e){if(!xe.has(e))throw new Error(`The gradient '${e}' for backend is not registered`);xe.delete(e)}function R0(e,t){Rn(e).forEach(s=>{const r=Object.assign({},s,{backendName:t});bc(r)})}function ys(e,t){return`${t}_${e}`}function wc(e){return e&&e.__esModule&&Object.prototype.hasOwnProperty.call(e,"default")?e.default:e}function Nc(e){if(Object.prototype.hasOwnProperty.call(e,"__esModule"))return e;var t=e.default;if(typeof t=="function"){var n=function s(){return this instanceof s?Reflect.construct(t,arguments,this.constructor):t.apply(this,arguments)};n.prototype=t.prototype}else n={};return Object.defineProperty(n,"__esModule",{value:!0}),Object.keys(e).forEach(function(s){var r=Object.getOwnPropertyDescriptor(e,s);Object.defineProperty(n,s,r.get?r:{enumerable:!0,get:function(){return e[s]}})}),n}var An,Js;function Tc(){if(Js)return An;Js=1,An=t;var e=null;try{e=new WebAssembly.Instance(new WebAssembly.Module(new Uint8Array([0,97,115,109,1,0,0,0,1,13,2,96,0,1,127,96,4,127,127,127,127,1,127,3,7,6,0,1,1,1,1,1,6,6,1,127,1,65,0,11,7,50,6,3,109,117,108,0,1,5,100,105,118,95,115,0,2,5,100,105,118,95,117,0,3,5,114,101,109,95,115,0,4,5,114,101,109,95,117,0,5,8,103,101,116,95,104,105,103,104,0,0,10,191,1,6,4,0,35,0,11,36,1,1,126,32,0,173,32,1,173,66,32,134,132,32,2,173,32,3,173,66,32,134,132,126,34,4,66,32,135,167,36,0,32,4,167,11,36,1,1,126,32,0,173,32,1,173,66,32,134,132,32,2,173,32,3,173,66,32,134,132,127,34,4,66,32,135,167,36,0,32,4,167,11,36,1,1,126,32,0,173,32,1,173,66,32,134,132,32,2,173,32,3,173,66,32,134,132,128,34,4,66,32,135,167,36,0,32,4,167,11,36,1,1,126,32,0,173,32,1,173,66,32,134,132,32,2,173,32,3,173,66,32,134,132,129,34,4,66,32,135,167,36,0,32,4,167,11,36,1,1,126,32,0,173,32,1,173,66,32,134,132,32,2,173,32,3,173,66,32,134,132,130,34,4,66,32,135,167,36,0,32,4,167,11])),{}).exports}catch{}function t(k,g,x){this.low=k|0,this.high=g|0,this.unsigned=!!x}t.prototype.__isLong__,Object.defineProperty(t.prototype,"__isLong__",{value:!0});function n(k){return(k&&k.__isLong__)===!0}t.isLong=n;var s={},r={};function a(k,g){var x,C,L;return g?(k>>>=0,(L=0<=k&&k<256)&&(C=r[k],C)?C:(x=i(k,(k|0)<0?-1:0,!0),L&&(r[k]=x),x)):(k|=0,(L=-128<=k&&k<128)&&(C=s[k],C)?C:(x=i(k,k<0?-1:0,!1),L&&(s[k]=x),x))}t.fromInt=a;function o(k,g){if(isNaN(k))return g?O:$;if(g){if(k<0)return O;if(k>=w)return B}else{if(k<=-T)return F;if(k+1>=T)return D}return k<0?o(-k,g).neg():i(k%d|0,k/d|0,g)}t.fromNumber=o;function i(k,g,x){return new t(k,g,x)}t.fromBits=i;var u=Math.pow;function c(k,g,x){if(k.length===0)throw Error("empty string");if(k==="NaN"||k==="Infinity"||k==="+Infinity"||k==="-Infinity")return $;if(typeof g=="number"?(x=g,g=!1):g=!!g,x=x||10,x<2||36<x)throw RangeError("radix");var C;if((C=k.indexOf("-"))>0)throw Error("interior hyphen");if(C===0)return c(k.substring(1),g,x).neg();for(var L=o(u(x,8)),P=$,q=0;q<k.length;q+=8){var G=Math.min(8,k.length-q),et=parseInt(k.substring(q,q+G),x);if(G<8){var Y=o(u(x,G));P=P.mul(Y).add(o(et))}else P=P.mul(L),P=P.add(o(et))}return P.unsigned=g,P}t.fromString=c;function h(k,g){return typeof k=="number"?o(k,g):typeof k=="string"?c(k,g):i(k.low,k.high,typeof g=="boolean"?g:k.unsigned)}t.fromValue=h;var p=65536,f=1<<24,d=p*p,w=d*d,T=w/2,S=a(f),$=a(0);t.ZERO=$;var O=a(0,!0);t.UZERO=O;var I=a(1);t.ONE=I;var _=a(1,!0);t.UONE=_;var A=a(-1);t.NEG_ONE=A;var D=i(-1,2147483647,!1);t.MAX_VALUE=D;var B=i(-1,-1,!0);t.MAX_UNSIGNED_VALUE=B;var F=i(0,-2147483648,!1);t.MIN_VALUE=F;var E=t.prototype;return E.toInt=function(){return this.unsigned?this.low>>>0:this.low},E.toNumber=function(){return this.unsigned?(this.high>>>0)*d+(this.low>>>0):this.high*d+(this.low>>>0)},E.toString=function(g){if(g=g||10,g<2||36<g)throw RangeError("radix");if(this.isZero())return"0";if(this.isNegative())if(this.eq(F)){var x=o(g),C=this.div(x),L=C.mul(x).sub(this);return C.toString(g)+L.toInt().toString(g)}else return"-"+this.neg().toString(g);for(var P=o(u(g,6),this.unsigned),q=this,G="";;){var et=q.div(P),Y=q.sub(et.mul(P)).toInt()>>>0,J=Y.toString(g);if(q=et,q.isZero())return J+G;for(;J.length<6;)J="0"+J;G=""+J+G}},E.getHighBits=function(){return this.high},E.getHighBitsUnsigned=function(){return this.high>>>0},E.getLowBits=function(){return this.low},E.getLowBitsUnsigned=function(){return this.low>>>0},E.getNumBitsAbs=function(){if(this.isNegative())return this.eq(F)?64:this.neg().getNumBitsAbs();for(var g=this.high!=0?this.high:this.low,x=31;x>0&&(g&1<<x)==0;x--);return this.high!=0?x+33:x+1},E.isZero=function(){return this.high===0&&this.low===0},E.eqz=E.isZero,E.isNegative=function(){return!this.unsigned&&this.high<0},E.isPositive=function(){return this.unsigned||this.high>=0},E.isOdd=function(){return(this.low&1)===1},E.isEven=function(){return(this.low&1)===0},E.equals=function(g){return n(g)||(g=h(g)),this.unsigned!==g.unsigned&&this.high>>>31===1&&g.high>>>31===1?!1:this.high===g.high&&this.low===g.low},E.eq=E.equals,E.notEquals=function(g){return!this.eq(g)},E.neq=E.notEquals,E.ne=E.notEquals,E.lessThan=function(g){return this.comp(g)<0},E.lt=E.lessThan,E.lessThanOrEqual=function(g){return this.comp(g)<=0},E.lte=E.lessThanOrEqual,E.le=E.lessThanOrEqual,E.greaterThan=function(g){return this.comp(g)>0},E.gt=E.greaterThan,E.greaterThanOrEqual=function(g){return this.comp(g)>=0},E.gte=E.greaterThanOrEqual,E.ge=E.greaterThanOrEqual,E.compare=function(g){if(n(g)||(g=h(g)),this.eq(g))return 0;var x=this.isNegative(),C=g.isNegative();return x&&!C?-1:!x&&C?1:this.unsigned?g.high>>>0>this.high>>>0||g.high===this.high&&g.low>>>0>this.low>>>0?-1:1:this.sub(g).isNegative()?-1:1},E.comp=E.compare,E.negate=function(){return!this.unsigned&&this.eq(F)?F:this.not().add(I)},E.neg=E.negate,E.add=function(g){n(g)||(g=h(g));var x=this.high>>>16,C=this.high&65535,L=this.low>>>16,P=this.low&65535,q=g.high>>>16,G=g.high&65535,et=g.low>>>16,Y=g.low&65535,J=0,bt=0,at=0,gt=0;return gt+=P+Y,at+=gt>>>16,gt&=65535,at+=L+et,bt+=at>>>16,at&=65535,bt+=C+G,J+=bt>>>16,bt&=65535,J+=x+q,J&=65535,i(at<<16|gt,J<<16|bt,this.unsigned)},E.subtract=function(g){return n(g)||(g=h(g)),this.add(g.neg())},E.sub=E.subtract,E.multiply=function(g){if(this.isZero())return $;if(n(g)||(g=h(g)),e){var x=e.mul(this.low,this.high,g.low,g.high);return i(x,e.get_high(),this.unsigned)}if(g.isZero())return $;if(this.eq(F))return g.isOdd()?F:$;if(g.eq(F))return this.isOdd()?F:$;if(this.isNegative())return g.isNegative()?this.neg().mul(g.neg()):this.neg().mul(g).neg();if(g.isNegative())return this.mul(g.neg()).neg();if(this.lt(S)&&g.lt(S))return o(this.toNumber()*g.toNumber(),this.unsigned);var C=this.high>>>16,L=this.high&65535,P=this.low>>>16,q=this.low&65535,G=g.high>>>16,et=g.high&65535,Y=g.low>>>16,J=g.low&65535,bt=0,at=0,gt=0,qe=0;return qe+=q*J,gt+=qe>>>16,qe&=65535,gt+=P*J,at+=gt>>>16,gt&=65535,gt+=q*Y,at+=gt>>>16,gt&=65535,at+=L*J,bt+=at>>>16,at&=65535,at+=P*Y,bt+=at>>>16,at&=65535,at+=q*et,bt+=at>>>16,at&=65535,bt+=C*J+L*Y+P*et+q*G,bt&=65535,i(gt<<16|qe,bt<<16|at,this.unsigned)},E.mul=E.multiply,E.divide=function(g){if(n(g)||(g=h(g)),g.isZero())throw Error("division by zero");if(e){if(!this.unsigned&&this.high===-2147483648&&g.low===-1&&g.high===-1)return this;var x=(this.unsigned?e.div_u:e.div_s)(this.low,this.high,g.low,g.high);return i(x,e.get_high(),this.unsigned)}if(this.isZero())return this.unsigned?O:$;var C,L,P;if(this.unsigned){if(g.unsigned||(g=g.toUnsigned()),g.gt(this))return O;if(g.gt(this.shru(1)))return _;P=O}else{if(this.eq(F)){if(g.eq(I)||g.eq(A))return F;if(g.eq(F))return I;var q=this.shr(1);return C=q.div(g).shl(1),C.eq($)?g.isNegative()?I:A:(L=this.sub(g.mul(C)),P=C.add(L.div(g)),P)}else if(g.eq(F))return this.unsigned?O:$;if(this.isNegative())return g.isNegative()?this.neg().div(g.neg()):this.neg().div(g).neg();if(g.isNegative())return this.div(g.neg()).neg();P=$}for(L=this;L.gte(g);){C=Math.max(1,Math.floor(L.toNumber()/g.toNumber()));for(var G=Math.ceil(Math.log(C)/Math.LN2),et=G<=48?1:u(2,G-48),Y=o(C),J=Y.mul(g);J.isNegative()||J.gt(L);)C-=et,Y=o(C,this.unsigned),J=Y.mul(g);Y.isZero()&&(Y=I),P=P.add(Y),L=L.sub(J)}return P},E.div=E.divide,E.modulo=function(g){if(n(g)||(g=h(g)),e){var x=(this.unsigned?e.rem_u:e.rem_s)(this.low,this.high,g.low,g.high);return i(x,e.get_high(),this.unsigned)}return this.sub(this.div(g).mul(g))},E.mod=E.modulo,E.rem=E.modulo,E.not=function(){return i(~this.low,~this.high,this.unsigned)},E.and=function(g){return n(g)||(g=h(g)),i(this.low&g.low,this.high&g.high,this.unsigned)},E.or=function(g){return n(g)||(g=h(g)),i(this.low|g.low,this.high|g.high,this.unsigned)},E.xor=function(g){return n(g)||(g=h(g)),i(this.low^g.low,this.high^g.high,this.unsigned)},E.shiftLeft=function(g){return n(g)&&(g=g.toInt()),(g&=63)===0?this:g<32?i(this.low<<g,this.high<<g|this.low>>>32-g,this.unsigned):i(0,this.low<<g-32,this.unsigned)},E.shl=E.shiftLeft,E.shiftRight=function(g){return n(g)&&(g=g.toInt()),(g&=63)===0?this:g<32?i(this.low>>>g|this.high<<32-g,this.high>>g,this.unsigned):i(this.high>>g-32,this.high>=0?0:-1,this.unsigned)},E.shr=E.shiftRight,E.shiftRightUnsigned=function(g){if(n(g)&&(g=g.toInt()),g&=63,g===0)return this;var x=this.high;if(g<32){var C=this.low;return i(C>>>g|x<<32-g,x>>>g,this.unsigned)}else return g===32?i(x,0,this.unsigned):i(x>>>g-32,0,this.unsigned)},E.shru=E.shiftRightUnsigned,E.shr_u=E.shiftRightUnsigned,E.toSigned=function(){return this.unsigned?i(this.low,this.high,!1):this},E.toUnsigned=function(){return this.unsigned?this:i(this.low,this.high,!0)},E.toBytes=function(g){return g?this.toBytesLE():this.toBytesBE()},E.toBytesLE=function(){var g=this.high,x=this.low;return[x&255,x>>>8&255,x>>>16&255,x>>>24,g&255,g>>>8&255,g>>>16&255,g>>>24]},E.toBytesBE=function(){var g=this.high,x=this.low;return[g>>>24,g>>>16&255,g>>>8&255,g&255,x>>>24,x>>>16&255,x>>>8&255,x&255]},t.fromBytes=function(g,x,C){return C?t.fromBytesLE(g,x):t.fromBytesBE(g,x)},t.fromBytesLE=function(g,x){return new t(g[0]|g[1]<<8|g[2]<<16|g[3]<<24,g[4]|g[5]<<8|g[6]<<16|g[7]<<24,x)},t.fromBytesBE=function(g,x){return new t(g[4]<<24|g[5]<<16|g[6]<<8|g[7],g[0]<<24|g[1]<<16|g[2]<<8|g[3],x)},An}var qr=Tc(),Ur=wc(qr),Sc=ao({__proto__:null,default:Ur},[qr]);/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */const Xt=Ur||Sc;function Re(e){return Xt.fromString(e,!0,16)}const Wr=Re("c3a5c85c97cb3127"),Ht=Re("b492b66fbe98f273"),ut=Re("9ae16a3b2f90404f");function zn(e){return e.xor(e.shru(47))}function jr(e,t,n){const s=e.slice(t,t+n);return Xt.fromBytes(Array.from(s),!0,!0)}function j(e,t){return jr(e,t,8)}function Zs(e,t){return jr(e,t,4)}function nt(e,t){return t===0?e:e.shru(t).or(e.shl(64-t))}function zt(e,t,n=Re("9ddfea08eb382d69")){let s=e.xor(t).mul(n);s=s.xor(s.shru(47));let r=t.xor(s).mul(n);return r=r.xor(r.shru(47)),r=r.mul(n),r}function $c(e,t,n,s,r,a){r=r.add(e),a=nt(a.add(r).add(s),21);const o=r;return r=r.add(t),r=r.add(n),a=a.add(nt(r,44)),[r.add(s),a.add(o)]}function Ue(e,t,n,s){return $c(j(e,t),j(e,t+8),j(e,t+16),j(e,t+24),n,s)}function kc(e,t=e.length){if(t>=8){const n=ut.add(t*2),s=j(e,0).add(ut),r=j(e,t-8),a=nt(r,37).mul(n).add(s),o=nt(s,25).add(r).mul(n);return zt(a,o,n)}if(t>=4){const n=ut.add(t*2),s=Zs(e,0);return zt(s.shl(3).add(t),Zs(e,t-4),n)}if(t>0){const n=e[0],s=e[t>>1],r=e[t-1],a=n+(s<<8),o=t+(r<<2);return zn(ut.mul(a).xor(Wr.mul(o))).mul(ut)}return ut}function Ec(e,t=e.length){const n=ut.add(t*2),s=j(e,0).mul(Ht),r=j(e,8),a=j(e,t-8).mul(n),o=j(e,t-16).mul(ut);return zt(nt(s.add(r),43).add(nt(a,30)).add(o),s.add(nt(r.add(ut),18)).add(a),n)}function vc(e,t=e.length){const n=ut.add(t*2),s=j(e,0).mul(ut),r=j(e,8),a=j(e,t-8).mul(n),o=j(e,t-16).mul(ut),i=nt(s.add(r),43).add(nt(a,30)).add(o),u=zt(i,s.add(nt(r.add(ut),18)).add(a),n),c=j(e,16).mul(n),h=j(e,24),p=i.add(j(e,t-32)).mul(n),f=u.add(j(e,t-24)).mul(n);return zt(nt(c.add(h),43).add(nt(p,30)).add(f),c.add(nt(h.add(s),18)).add(p),n)}function _c(e,t=e.length){const n=Xt.fromNumber(81,!0);if(t<=32)return t<=16?kc(e,t):Ec(e,t);if(t<=64)return vc(e,t);let s=n,r=n.mul(Ht).add(113),a=zn(r.mul(ut).add(113)).mul(ut),o=[Xt.UZERO,Xt.UZERO],i=[Xt.UZERO,Xt.UZERO];s=s.mul(ut).add(j(e,0));let u=0;const c=(t-1>>6)*64,h=c+(t-1&63)-63;do s=nt(s.add(r).add(o[0]).add(j(e,u+8)),37).mul(Ht),r=nt(r.add(o[1]).add(j(e,u+48)),42).mul(Ht),s=s.xor(i[1]),r=r.add(o[0]).add(j(e,u+40)),a=nt(a.add(i[0]),33).mul(Ht),o=Ue(e,u,o[1].mul(Ht),s.add(i[0])),i=Ue(e,u+32,a.add(i[1]),r.add(j(e,u+16))),[a,s]=[s,a],u+=64;while(u!==c);const p=Ht.add(a.and(255).shl(1));return u=h,i[0]=i[0].add(t-1&63),o[0]=o[0].add(i[0]),i[0]=i[0].add(o[0]),s=nt(s.add(r).add(o[0]).add(j(e,u+8)),37).mul(p),r=nt(r.add(o[1]).add(j(e,u+48)),42).mul(p),s=s.xor(i[1].mul(9)),r=r.add(o[0].mul(9).add(j(e,u+40))),a=nt(a.add(i[0]),33).mul(p),o=Ue(e,u,o[1].mul(p),s.add(i[0])),i=Ue(e,u+32,a.add(i[1]),r.add(j(e,u+16))),[a,s]=[s,a],zt(zt(o[0],i[0],p).add(zn(r).mul(Wr)).add(a),zt(o[1],i[1],p).add(s),p)}/**
 * @license
 * Copyright 2017 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function xc(e,t){return t==="string"?bs(e):gn([e],t)}function Ic(e,t){return e instanceof Float32Array&&t==="float32"||e instanceof Int32Array&&t==="int32"||e instanceof Uint8Array&&t==="bool"}function gn(e,t){if(t==="string")throw new Error("Cannot convert a string[] to a TypedArray");if(Array.isArray(e)&&(e=Be(e)),R().getBool("DEBUG")&&Ir(e,t),Ic(e,t))return e;if(t==null||t==="float32"||t==="complex64")return new Float32Array(e);if(t==="int32")return new Int32Array(e);if(t==="bool"){const n=new Uint8Array(e.length);for(let s=0;s<n.length;++s)Math.round(e[s])!==0&&(n[s]=1);return n}else throw new Error(`Unknown data type ${t}`)}function Ie(){return R().platform.now()}function Ac(e,t){return R().platform.fetch(e,t)}function bs(e,t="utf-8"){return t=t||"utf-8",R().platform.encode(e,t)}function Vn(e,t="utf-8"){return t=t||"utf-8",R().platform.decode(e,t)}var z0=Object.freeze({__proto__:null,arraysEqual:Ot,assert:y,assertNonNegativeIntegerDimensions:ds,assertNonNull:ie,assertShapesMatch:ht,bytesFromStringArray:Dr,bytesPerElement:Pn,checkConversionForErrors:Ir,clamp:lo,computeStrides:Pe,createScalarValue:xc,createShuffledIndices:wo,decodeString:Vn,distSquared:mo,encodeString:bs,fetch:Ac,fingerPrint64:_c,flatten:Be,getArrayFromDType:xr,getTypedArrayFromDType:_r,hasEncodingLoss:So,hexToLong:Re,indexToLoc:vo,inferDtype:mn,inferFromImplicitShape:To,isBoolean:Or,isFunction:qt,isInt:de,isNumber:Fr,isPromise:te,isScalarShape:go,isString:fn,isTypedArray:Et,isValidDtype:Ar,locToIndex:Eo,makeOnesTypedArray:ms,makeZerosNestedTypedArray:ko,makeZerosTypedArray:dn,nearestDivisor:$o,nearestLargerEven:po,now:Ie,parseAxisParam:Le,randUniform:fo,repeatedTry:No,rightPad:Ee,shuffle:Er,shuffleCombo:co,sizeFromShape:Q,sizeToSquarishShape:bo,squeezeShape:vr,sum:ho,swap:en,tanh:yo,toNestedArray:Zt,toTypedArray:gn});/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */class Dc{constructor(t,n){this.backendTimer=t,this.logger=n,n==null&&(this.logger=new Fc)}profileKernel(t,n,s){let r;const a=()=>{r=s()};let o;const i=Ie();if(this.backendTimer.timerAvailable())o=this.backendTimer.time(a);else{a();for(const c of r)c.dataSync();o=Promise.resolve({kernelMs:Ie()-i})}if(R().getBool("CHECK_COMPUTATION_FOR_ERRORS"))for(let c=0;c<r.length;c++){const h=r[c];h.data().then(p=>{Oc(p,h.dtype,t)})}return{kernelName:t,outputs:r,inputs:n,timeMs:o.then(c=>c.kernelMs),extraInfo:o.then(c=>c.getExtraProfileInfo!=null?c.getExtraProfileInfo():"")}}logKernelProfile(t){const{kernelName:n,outputs:s,timeMs:r,inputs:a,extraInfo:o}=t;s.forEach(i=>{Promise.all([i.data(),r,o]).then(u=>{this.logger.logKernelProfile(n,i,u[0],u[1],a,u[2])})})}}function Oc(e,t,n){if(t!=="float32")return!1;for(let s=0;s<e.length;s++){const r=e[s];if(isNaN(r)||!isFinite(r))return console.warn(`Found ${r} in the result of '${n}'`),!0}return!1}class Fc{logKernelProfile(t,n,s,r,a,o){const i=typeof r=="number"?Ee(`${r}ms`,9):r.error,u=Ee(t,25),c=n.rank,h=n.size,p=Ee(n.shape.toString(),14);let f="";for(const d in a){const w=a[d];if(w!=null){const T=w.shape||n.shape,S=T.length;f+=`${d}: ${S}D ${S>0?T:""} `}}console.log(`%c${u}	%c${i}	%c${c}D ${p}	%c${h}	%c${f}	%c${o}`,"font-weight:bold","color:red","color:blue","color: orange","color: green","color: steelblue")}}/**
 * @license
 * Copyright 2017 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Cc(e,t,n){const s={},r={};for(let u=0;u<t.length;u++)s[t[u].id]=!0;for(let u=0;u<e.length;u++){const c=e[u],h=c.inputs;for(const p in h){const f=h[p];let d=!1;for(let w=0;w<t.length;w++)if(s[f.id]){c.outputs.forEach(T=>s[T.id]=!0),d=!0,r[c.id]=!0;break}if(d)break}}const a={};a[n.id]=!0;const o={};for(let u=e.length-1;u>=0;u--){const c=e[u],h=c.inputs;for(let p=0;p<c.outputs.length;p++)if(a[c.outputs[p].id]){for(const f in h)a[h[f].id]=!0,o[c.id]=!0;break}}const i=[];for(let u=0;u<e.length;u++){const c=e[u];if(r[c.id]&&o[c.id]){const h={};for(const f in c.inputs){const d=c.inputs[f];s[d.id]&&(h[f]=d)}const p=Object.assign({},c);p.inputs=h,p.outputs=c.outputs,i.push(p)}}return i}function Bc(e,t,n,s){for(let r=t.length-1;r>=0;r--){const a=t[r],o=[];if(a.outputs.forEach(u=>{const c=e[u.id];c!=null?o.push(c):o.push(null)}),a.gradient==null)throw new Error(`Cannot compute gradient: gradient function not found for ${a.kernelName}.`);const i=a.gradient(o);for(const u in a.inputs){if(!(u in i))throw new Error(`Cannot backprop through input ${u}. Available gradients found: ${Object.keys(i)}.`);const c=n(()=>i[u]());if(c.dtype!=="float32")throw new Error(`Error in gradient for op ${a.kernelName}. The gradient of input ${u} must have 'float32' dtype, but has '${c.dtype}'`);const h=a.inputs[u];if(!Ot(c.shape,h.shape))throw new Error(`Error in gradient for op ${a.kernelName}. The gradient of input '${u}' has shape '${c.shape}', which does not match the shape of the input '${h.shape}'`);if(e[h.id]==null)e[h.id]=c;else{const p=e[h.id];e[h.id]=s(p,c),p.dispose()}}}}/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */const Qs=20,Te=3,Dn=7;function Lc(e,t,n,s){const r=Pe(t),a=Pc(e,t,n,r),o=t.length,i=je(e,t,n,r,a),u=["Tensor"];return s&&(u.push(`  dtype: ${n}`),u.push(`  rank: ${o}`),u.push(`  shape: [${t}]`),u.push("  values:")),u.push(i.map(c=>"    "+c).join(`
`)),u.join(`
`)}function Pc(e,t,n,s){const r=Q(t),a=s[s.length-1],o=new Array(a).fill(0),i=t.length,u=n==="complex64"?ke(e):e;if(i>1)for(let c=0;c<r/a;c++){const h=c*a;for(let p=0;p<a;p++)o[p]=Math.max(o[p],$e(u[h+p],0,n).length)}return o}function $e(e,t,n){let s;return Array.isArray(e)?s=`${parseFloat(e[0].toFixed(Dn))} + ${parseFloat(e[1].toFixed(Dn))}j`:fn(e)?s=`'${e}'`:n==="bool"?s=Kr(e):s=parseFloat(e.toFixed(Dn)).toString(),Ee(s,t)}function Kr(e){return e===0?"false":"true"}function je(e,t,n,s,r,a=!0){const o=n==="complex64"?2:1,i=t[0],u=t.length;if(u===0){if(n==="complex64"){const T=ke(e);return[$e(T[0],0,n)]}return n==="bool"?[Kr(e[0])]:[e[0].toString()]}if(u===1){if(i>Qs){const S=Te*o;let $=Array.from(e.slice(0,S)),O=Array.from(e.slice((i-Te)*o,i*o));return n==="complex64"&&($=ke($),O=ke(O)),["["+$.map((I,_)=>$e(I,r[_],n)).join(", ")+", ..., "+O.map((I,_)=>$e(I,r[i-Te+_],n)).join(", ")+"]"]}return["["+(n==="complex64"?ke(e):Array.from(e)).map((S,$)=>$e(S,r[$],n)).join(", ")+"]"]}const c=t.slice(1),h=s.slice(1),p=s[0]*o,f=[];if(i>Qs){for(let T=0;T<Te;T++){const S=T*p,$=S+p;f.push(...je(e.slice(S,$),c,n,h,r,!1))}f.push("...");for(let T=i-Te;T<i;T++){const S=T*p,$=S+p;f.push(...je(e.slice(S,$),c,n,h,r,T===i-1))}}else for(let T=0;T<i;T++){const S=T*p,$=S+p;f.push(...je(e.slice(S,$),c,n,h,r,T===i-1))}const d=u===2?",":"";f[0]="["+f[0]+d;for(let T=1;T<f.length-1;T++)f[T]=" "+f[T]+d;let w=`,
`;for(let T=2;T<u;T++)w+=`
`;return f[f.length-1]=" "+f[f.length-1]+"]"+(a?"":w),f}function ke(e){const t=[];for(let n=0;n<e.length;n+=2)t.push([e[n],e[n+1]]);return t}/**
 * @license
 * Copyright 2017 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */class qn{constructor(t,n,s){if(this.dtype=n,this.shape=t.slice(),this.size=Q(t),s!=null){const r=s.length;y(r===this.size,()=>`Length of values '${r}' does not match the size inferred by the shape '${this.size}'.`)}if(n==="complex64")throw new Error("complex64 dtype TensorBuffers are not supported. Please create a TensorBuffer for the real and imaginary parts separately and call tf.complex(real, imag).");this.values=s||xr(n,this.size),this.strides=Pe(t)}set(t,...n){n.length===0&&(n=[0]),y(n.length===this.rank,()=>`The number of provided coordinates (${n.length}) must match the rank (${this.rank})`);const s=this.locToIndex(n);this.values[s]=t}get(...t){t.length===0&&(t=[0]);let n=0;for(const r of t){if(r<0||r>=this.shape[n]){const a=`Requested out of range element at ${t}.   Buffer shape=${this.shape}`;throw new Error(a)}n++}let s=t[t.length-1];for(let r=0;r<t.length-1;++r)s+=this.strides[r]*t[r];return this.values[s]}locToIndex(t){if(this.rank===0)return 0;if(this.rank===1)return t[0];let n=t[t.length-1];for(let s=0;s<t.length-1;++s)n+=this.strides[s]*t[s];return n}indexToLoc(t){if(this.rank===0)return[];if(this.rank===1)return[t];const n=new Array(this.shape.length);for(let s=0;s<n.length-1;++s)n[s]=Math.floor(t/this.strides[s]),t-=n[s]*this.strides[s];return n[n.length-1]=t,n}get rank(){return this.shape.length}toTensor(){return St().makeTensor(this.values,this.shape,this.dtype)}}let St=null,ce=null;function Rc(e){St=e}function zc(e){ce=e}class Z{constructor(t,n,s,r){this.kept=!1,this.isDisposedInternal=!1,this.shape=t.slice(),this.dtype=n||"float32",this.size=Q(t),this.strides=Pe(t),this.dataId=s,this.id=r,this.rankType=this.rank<5?this.rank.toString():"higher"}get rank(){return this.shape.length}async buffer(){const t=await this.data();return ce.buffer(this.shape,this.dtype,t)}bufferSync(){return ce.buffer(this.shape,this.dtype,this.dataSync())}async array(){const t=await this.data();return Zt(this.shape,t,this.dtype==="complex64")}arraySync(){return Zt(this.shape,this.dataSync(),this.dtype==="complex64")}async data(){this.throwIfDisposed();const t=St().read(this.dataId);if(this.dtype==="string"){const n=await t;try{return n.map(s=>Vn(s))}catch{throw new Error("Failed to decode the string bytes into utf-8. To get the original bytes, call tensor.bytes().")}}return t}dataToGPU(t){return this.throwIfDisposed(),St().readToGPU(this.dataId,t)}dataSync(){this.throwIfDisposed();const t=St().readSync(this.dataId);if(this.dtype==="string")try{return t.map(n=>Vn(n))}catch{throw new Error("Failed to decode the string bytes into utf-8. To get the original bytes, call tensor.bytes().")}return t}async bytes(){this.throwIfDisposed();const t=await St().read(this.dataId);return this.dtype==="string"?t:new Uint8Array(t.buffer)}dispose(){this.isDisposed||(St().disposeTensor(this),this.isDisposedInternal=!0)}get isDisposed(){return this.isDisposedInternal}throwIfDisposed(){if(this.isDisposed)throw new Error("Tensor is disposed.")}print(t=!1){return ce.print(this,t)}clone(){return this.throwIfDisposed(),ce.clone(this)}toString(t=!1){const n=this.dataSync();return Lc(n,this.shape,this.dtype,t)}cast(t){return this.throwIfDisposed(),ce.cast(this,t)}variable(t=!0,n,s){return this.throwIfDisposed(),St().makeVariable(this,t,n,s)}}Object.defineProperty(Z,Symbol.hasInstance,{value:e=>!!e&&e.data!=null&&e.dataSync!=null&&e.throwIfDisposed!=null});function Vc(){return gs("Tensor",()=>Z)}Vc();class nn extends Z{constructor(t,n,s,r){super(t.shape,t.dtype,t.dataId,r),this.trainable=n,this.name=s}assign(t){if(t.dtype!==this.dtype)throw new Error(`dtype of the new value (${t.dtype}) and previous value (${this.dtype}) must match`);if(!Ot(t.shape,this.shape))throw new Error(`shape of the new value (${t.shape}) and previous value (${this.shape}) must match`);St().disposeTensor(this),this.dataId=t.dataId,St().incRef(this,null)}dispose(){St().disposeVariable(this),this.isDisposedInternal=!0}}Object.defineProperty(nn,Symbol.hasInstance,{value:e=>e instanceof Z&&e.assign!=null&&e.assign instanceof Function});/**
 * @license
 * Copyright 2017 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */var tr;(function(e){e.R0="R0",e.R1="R1",e.R2="R2",e.R3="R3",e.R4="R4",e.R5="R5",e.R6="R6"})(tr||(tr={}));var Un;(function(e){e.float32="float32",e.int32="int32",e.bool="int32",e.complex64="complex64"})(Un||(Un={}));var Wn;(function(e){e.float32="float32",e.int32="int32",e.bool="bool",e.complex64="complex64"})(Wn||(Wn={}));var jn;(function(e){e.float32="float32",e.int32="float32",e.bool="float32",e.complex64="complex64"})(jn||(jn={}));var Kn;(function(e){e.float32="complex64",e.int32="complex64",e.bool="complex64",e.complex64="complex64"})(Kn||(Kn={}));const qc={float32:jn,int32:Un,bool:Wn,complex64:Kn};function Hr(e,t){if(e==="string"||t==="string"){if(e==="string"&&t==="string")return"string";throw new Error(`Can not upcast ${e} with ${t}`)}return qc[e][t]}function V0(e){return Hr(e,"int32")}/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function X(e,t){if(e.dtype===t.dtype)return[e,t];const n=Hr(e.dtype,t.dtype);return[e.cast(n),t.cast(n)]}function Gr(e,t){y(e.dtype===t.dtype,()=>`The dtypes of the first(${e.dtype}) and second(${t.dtype}) input must match`)}function Uc(e,t){return t.some(n=>n.id===e.id)}function ws(e){const t=[];return Mr(e,t,new Set),t}function Mr(e,t,n){if(e==null)return;if(e instanceof Z){t.push(e);return}if(!Wc(e))return;const s=e;for(const r in s){const a=s[r];n.has(a)||(n.add(a),Mr(a,t,n))}}function Wc(e){return Array.isArray(e)||typeof e=="object"}var q0=Object.freeze({__proto__:null,assertTypesMatch:Gr,getTensorsInContainer:ws,isTensorInList:Uc,makeTypesMatch:X});/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function On(e){return e.kernelName!=null}class er{constructor(){this.registeredVariables={},this.nextTapeNodeId=0,this.numBytes=0,this.numTensors=0,this.numStringTensors=0,this.numDataBuffers=0,this.gradientDepth=0,this.kernelDepth=0,this.scopeStack=[],this.numDataMovesStack=[],this.nextScopeId=0,this.tensorInfo=new WeakMap,this.profiling=!1,this.activeProfile={newBytes:0,newTensors:0,peakBytes:0,kernels:[],result:null,get kernelNames(){return Array.from(new Set(this.kernels.map(t=>t.name)))}}}dispose(){for(const t in this.registeredVariables)this.registeredVariables[t].dispose()}}class ye{constructor(t){this.ENV=t,this.registry={},this.registryFactory={},this.pendingBackendInitId=0,this.state=new er}async ready(){if(this.pendingBackendInit!=null)return this.pendingBackendInit.then(()=>{});if(this.backendInstance!=null)return;const t=this.getSortedBackends();for(let n=0;n<t.length;n++){const s=t[n];if(await this.initializeBackend(s).success){await this.setBackend(s);return}}throw new Error("Could not initialize any backends, all backend initializations failed.")}get backend(){if(this.pendingBackendInit!=null)throw new Error(`Backend '${this.backendName}' has not yet been initialized. Make sure to await tf.ready() or await tf.setBackend() before calling other methods`);if(this.backendInstance==null){const{name:t,asyncInit:n}=this.initializeBackendsAndReturnBest();if(n)throw new Error(`The highest priority backend '${t}' has not yet been initialized. Make sure to await tf.ready() or await tf.setBackend() before calling other methods`);this.setBackend(t)}return this.backendInstance}backendNames(){return Object.keys(this.registryFactory)}findBackend(t){if(!(t in this.registry))if(t in this.registryFactory){const{asyncInit:n}=this.initializeBackend(t);if(n)return null}else return null;return this.registry[t]}findBackendFactory(t){return t in this.registryFactory?this.registryFactory[t].factory:null}registerBackend(t,n,s=1){return t in this.registryFactory?(Mt(`${t} backend was already registered. Reusing existing backend factory.`),!1):(this.registryFactory[t]={factory:n,priority:s},!0)}async setBackend(t){if(this.registryFactory[t]==null)throw new Error(`Backend name '${t}' not found in registry`);if(this.backendName=t,this.registry[t]==null){this.backendInstance=null;const{success:n,asyncInit:s}=this.initializeBackend(t);if(!(s?await n:n))return!1}return this.backendInstance=this.registry[t],this.setupRegisteredKernels(),this.profiler=new Dc(this.backendInstance),!0}setupRegisteredKernels(){Rn(this.backendName).forEach(n=>{n.setupFunc!=null&&n.setupFunc(this.backendInstance)})}disposeRegisteredKernels(t){Rn(t).forEach(s=>{s.disposeFunc!=null&&s.disposeFunc(this.registry[t])})}initializeBackend(t){const n=this.registryFactory[t];if(n==null)throw new Error(`Cannot initialize backend ${t}, no registration found.`);try{const s=n.factory();if(s&&!(s instanceof uo)&&typeof s.then=="function"){const r=++this.pendingBackendInitId,a=s.then(o=>r<this.pendingBackendInitId?!1:(this.registry[t]=o,this.pendingBackendInit=null,!0)).catch(o=>(r<this.pendingBackendInitId||(this.pendingBackendInit=null,Mt(`Initialization of backend ${t} failed`),Mt(o.stack||o.message)),!1));return this.pendingBackendInit=a,{success:a,asyncInit:!0}}else return this.registry[t]=s,{success:!0,asyncInit:!1}}catch(s){return Mt(`Initialization of backend ${t} failed`),Mt(s.stack||s.message),{success:!1,asyncInit:!1}}}removeBackend(t){if(!(t in this.registryFactory))throw new Error(`${t} backend not found in registry`);this.backendName===t&&this.pendingBackendInit!=null&&this.pendingBackendInitId++,t in this.registry&&(this.disposeRegisteredKernels(t),this.registry[t].dispose(),delete this.registry[t]),delete this.registryFactory[t],this.backendName===t&&(this.pendingBackendInit=null,this.backendName=null,this.backendInstance=null)}getSortedBackends(){if(Object.keys(this.registryFactory).length===0)throw new Error("No backend found in registry.");return Object.keys(this.registryFactory).sort((t,n)=>this.registryFactory[n].priority-this.registryFactory[t].priority)}initializeBackendsAndReturnBest(){const t=this.getSortedBackends();for(let n=0;n<t.length;n++){const s=t[n],{success:r,asyncInit:a}=this.initializeBackend(s);if(a||r)return{name:s,asyncInit:a}}throw new Error("Could not initialize any backends, all backend initializations failed.")}moveData(t,n){const s=this.state.tensorInfo.get(n),r=s.backend,a=this.readSync(n),o=r.refCount(n);r.disposeData(n,!0),s.backend=t,t.move(n,a,s.shape,s.dtype,o),this.shouldCheckForMemLeaks()&&this.state.numDataMovesStack[this.state.numDataMovesStack.length-1]++}tidy(t,n){let s=null;if(n==null){if(typeof t!="function")throw new Error("Please provide a function to tidy()");n=t}else{if(typeof t!="string"&&!(t instanceof String))throw new Error("When calling with two arguments, the first argument to tidy() must be a string");if(typeof n!="function")throw new Error("When calling with two arguments, the 2nd argument to tidy() must be a function");s=t}let r;return this.scopedRun(()=>this.startScope(s),()=>this.endScope(r),()=>(r=n(),r instanceof Promise&&console.error("Cannot return a Promise inside of tidy."),r))}scopedRun(t,n,s){t();try{const r=s();return n(),r}catch(r){throw n(),r}}nextTensorId(){return ye.nextTensorId++}nextVariableId(){return ye.nextVariableId++}clone(t){const n=N.runKernel(zr,{x:t}),s={x:t},r=o=>({x:()=>{const i="float32",u={x:o},c={dtype:i};return N.runKernel(Rr,u,c)}}),a=[];return this.addTapeNode(this.state.activeScope.name,s,[n],r,a,{}),n}runKernel(t,n,s){if(this.backendName==null&&this.backend,!(Xs(t,this.backendName)!=null))throw new Error(`Kernel '${t}' not registered for backend '${this.backendName}'`);return this.runKernelFunc({kernelName:t,inputs:n,attrs:s})}shouldCheckForMemLeaks(){return this.ENV.getBool("IS_TEST")}checkKernelForMemLeak(t,n,s){const r=this.backend.numDataIds();let a=0;s.forEach(u=>{a+=u.dtype==="complex64"?3:1});const o=this.state.numDataMovesStack[this.state.numDataMovesStack.length-1],i=r-n-a-o;if(i>0)throw new Error(`Backend '${this.backendName}' has an internal memory leak (${i} data ids) after running '${t}'`)}runKernelFunc(t){let n,s=[];const r=this.isTapeOn(),a=this.state.numBytes,o=this.state.numTensors;this.shouldCheckForMemLeaks()&&this.state.numDataMovesStack.push(0);let i;this.backendName==null&&this.backend;let u;const c=On(t)?t.kernelName:this.state.activeScope!=null?this.state.activeScope.name:"";if(On(t)){const{kernelName:w,inputs:T,attrs:S}=t;this.backendName==null&&this.backend;const $=Xs(w,this.backendName);y($!=null,()=>`Cannot find registered kernel '${w}' for backend '${this.backendName}'`),i=()=>{const O=this.backend.numDataIds();u=$.kernelFunc({inputs:T,attrs:S,backend:this.backend});const I=Array.isArray(u)?u:[u];this.shouldCheckForMemLeaks()&&this.checkKernelForMemLeak(w,O,I);const _=I.map(A=>A.rank!=null?A:this.makeTensorFromTensorInfo(A));if(r){const A=this.getTensorsForGradient(w,T,_);s=this.saveTensorsForBackwardMode(A)}return _}}else{const{forwardFunc:w}=t,T=S=>{r&&(s=S.map($=>this.keep(this.clone($))))};i=()=>{const S=this.backend.numDataIds();u=this.tidy(()=>w(this.backend,T));const $=Array.isArray(u)?u:[u];return this.shouldCheckForMemLeaks()&&this.checkKernelForMemLeak(c,S,$),$}}const{inputs:h,attrs:p}=t,f=On(t)?null:t.backwardsFunc;let d;return this.scopedRun(()=>this.state.kernelDepth++,()=>this.state.kernelDepth--,()=>{!this.ENV.getBool("DEBUG")&&!this.state.profiling?n=i():(d=this.profiler.profileKernel(c,h,()=>i()),this.ENV.getBool("DEBUG")&&this.profiler.logKernelProfile(d),n=d.outputs)}),r&&this.addTapeNode(c,h,n,f,s,p),this.state.profiling&&this.state.activeProfile.kernels.push({name:c,bytesAdded:this.state.numBytes-a,totalBytesSnapshot:this.state.numBytes,tensorsAdded:this.state.numTensors-o,totalTensorsSnapshot:this.state.numTensors,inputShapes:Object.keys(h).map(w=>h[w]!=null?h[w].shape:null),outputShapes:n.map(w=>w.shape),kernelTimeMs:d.timeMs,extraInfo:d.extraInfo}),Array.isArray(u)?n:n[0]}saveTensorsForBackwardMode(t){return t.map(s=>this.keep(this.clone(s)))}getTensorsForGradient(t,n,s){const r=Ys(t);if(r!=null){const a=r.inputsToSave||[],o=r.outputsToSave||[];let i;r.saveAllInputs?(y(Array.isArray(n),()=>"saveAllInputs is true, expected inputs to be an array."),i=Object.keys(n).map(c=>n[c])):i=a.map(c=>n[c]);const u=s.filter((c,h)=>o[h]);return i.concat(u)}return[]}makeTensor(t,n,s,r){if(t==null)throw new Error("Values passed to engine.makeTensor() are null");s=s||"float32",r=r||this.backend;let a=t;s==="string"&&fn(t[0])&&(a=t.map(u=>bs(u)));const o=r.write(a,n,s),i=new Z(n,s,o,this.nextTensorId());if(this.trackTensor(i,r),s==="string"){const u=this.state.tensorInfo.get(o),c=Dr(a);this.state.numBytes+=c-u.bytes,u.bytes=c}return i}makeTensorFromDataId(t,n,s,r){s=s||"float32";const a={dataId:t,shape:n,dtype:s};return this.makeTensorFromTensorInfo(a,r)}makeTensorFromTensorInfo(t,n){const{dataId:s,shape:r,dtype:a}=t,o=new Z(r,a,s,this.nextTensorId());return this.trackTensor(o,n),o}makeVariable(t,n=!0,s,r){s=s||this.nextVariableId().toString(),r!=null&&r!==t.dtype&&(t=t.cast(r));const a=new nn(t,n,s,this.nextTensorId());if(this.state.registeredVariables[a.name]!=null)throw new Error(`Variable with name ${a.name} was already registered`);return this.state.registeredVariables[a.name]=a,this.incRef(a,this.backend),a}trackTensor(t,n){this.state.numTensors++,t.dtype==="string"&&this.state.numStringTensors++;let s=0;t.dtype!=="complex64"&&t.dtype!=="string"&&(s=t.size*Pn(t.dtype)),this.state.numBytes+=s,this.state.tensorInfo.has(t.dataId)||(this.state.numDataBuffers++,this.state.tensorInfo.set(t.dataId,{backend:n||this.backend,dtype:t.dtype,shape:t.shape,bytes:s})),t instanceof nn||this.track(t)}incRef(t,n){this.trackTensor(t,n),this.backend.incRef(t.dataId)}removeDataId(t,n){this.state.tensorInfo.has(t)&&this.state.tensorInfo.get(t).backend===n&&(this.state.tensorInfo.delete(t),this.state.numDataBuffers--)}disposeTensor(t){if(!this.state.tensorInfo.has(t.dataId))return;const n=this.state.tensorInfo.get(t.dataId);if(this.state.numTensors--,t.dtype==="string"&&(this.state.numStringTensors--,this.state.numBytes-=n.bytes),t.dtype!=="complex64"&&t.dtype!=="string"){const s=t.size*Pn(t.dtype);this.state.numBytes-=s}n.backend.disposeData(t.dataId)&&this.removeDataId(t.dataId,n.backend)}disposeVariables(){for(const t in this.state.registeredVariables){const n=this.state.registeredVariables[t];this.disposeVariable(n)}}disposeVariable(t){this.disposeTensor(t),this.state.registeredVariables[t.name]!=null&&delete this.state.registeredVariables[t.name]}memory(){const t=this.backend.memory();return t.numTensors=this.state.numTensors,t.numDataBuffers=this.state.numDataBuffers,t.numBytes=this.state.numBytes,this.state.numStringTensors>0&&(t.unreliable=!0,t.reasons==null&&(t.reasons=[]),t.reasons.push("Memory usage by string tensors is approximate (2 bytes per character)")),t}async profile(t){this.state.profiling=!0;const n=this.state.numBytes,s=this.state.numTensors;this.state.activeProfile.kernels=[],this.state.activeProfile.result=await t(),this.state.profiling=!1,this.state.activeProfile.peakBytes=Math.max(...this.state.activeProfile.kernels.map(r=>r.totalBytesSnapshot)),this.state.activeProfile.newBytes=this.state.numBytes-n,this.state.activeProfile.newTensors=this.state.numTensors-s;for(const r of this.state.activeProfile.kernels)r.kernelTimeMs=await r.kernelTimeMs,r.extraInfo=await r.extraInfo;return this.state.activeProfile}isTapeOn(){return this.state.gradientDepth>0&&this.state.kernelDepth===0}addTapeNode(t,n,s,r,a,o){const i={id:this.state.nextTapeNodeId++,kernelName:t,inputs:n,outputs:s,saved:a},u=Ys(t);u!=null&&(r=u.gradFunc),r!=null&&(i.gradient=c=>(c=c.map((h,p)=>{if(h==null){const f=s[p],d=dn(f.size,f.dtype);return this.makeTensor(d,f.shape,f.dtype)}return h}),r(c.length>1?c:c[0],a,o))),this.state.activeTape.push(i)}keep(t){return t.kept=!0,t}startTape(){this.state.gradientDepth===0&&(this.state.activeTape=[]),this.state.gradientDepth++}endTape(){this.state.gradientDepth--}startScope(t){const n={track:[],name:"unnamed scope",id:this.state.nextScopeId++};t&&(n.name=t),this.state.scopeStack.push(n),this.state.activeScope=n}endScope(t){const n=ws(t),s=new Set(n.map(a=>a.id));for(let a=0;a<this.state.activeScope.track.length;a++){const o=this.state.activeScope.track[a];!o.kept&&!s.has(o.id)&&o.dispose()}const r=this.state.scopeStack.pop();this.state.activeScope=this.state.scopeStack.length===0?null:this.state.scopeStack[this.state.scopeStack.length-1],n.forEach(a=>{!a.kept&&a.scopeId===r.id&&this.track(a)})}gradients(t,n,s,r=!1){if(y(n.length>0,()=>"gradients() received an empty list of xs."),s!=null&&s.dtype!=="float32")throw new Error(`dy must have 'float32' dtype, but has '${s.dtype}'`);const a=this.scopedRun(()=>this.startTape(),()=>this.endTape(),()=>this.tidy("forward",t));y(a instanceof Z,()=>"The result y returned by f() must be a tensor.");const o=Cc(this.state.activeTape,n,a);if(!r&&o.length===0&&n.length>0)throw new Error("Cannot compute gradient of y=f(x) with respect to x. Make sure that the f you passed encloses all operations that lead from x to y.");return this.tidy("backward",()=>{const i={};i[a.id]=s??jc(a.shape),Bc(i,o,c=>this.tidy(c),Kc);const u=n.map(c=>i[c.id]);return this.state.gradientDepth===0&&(this.state.activeTape.forEach(c=>{for(const h of c.saved)h.dispose()}),this.state.activeTape=null),{value:a,grads:u}})}customGrad(t){return y(qt(t),()=>"The f passed in customGrad(f) must be a function."),(...n)=>{y(n.every(i=>i instanceof Z),()=>"The args passed in customGrad(f)(x1, x2,...) must all be tensors");let s;const r={};n.forEach((i,u)=>{r[u]=i});const a=(i,u)=>(s=t(...n,u),y(s.value instanceof Z,()=>"The function f passed in customGrad(f) must return an object where `obj.value` is a tensor"),y(qt(s.gradFunc),()=>"The function f passed in customGrad(f) must return an object where `obj.gradFunc` is a function."),s.value),o=(i,u)=>{const c=s.gradFunc(i,u),h=Array.isArray(c)?c:[c];y(h.length===n.length,()=>"The function f passed in customGrad(f) must return an object where `obj.gradFunc` is a function that returns the same number of tensors as inputs passed to f(...)."),y(h.every(f=>f instanceof Z),()=>"The function f passed in customGrad(f) must return an object where `obj.gradFunc` is a function that returns a list of only tensors.");const p={};return h.forEach((f,d)=>{p[d]=()=>f}),p};return this.runKernelFunc({forwardFunc:a,backwardsFunc:o,inputs:r})}}readSync(t){return this.state.tensorInfo.get(t).backend.readSync(t)}read(t){return this.state.tensorInfo.get(t).backend.read(t)}readToGPU(t,n){return this.state.tensorInfo.get(t).backend.readToGPU(t,n)}async time(t){const n=Ie(),s=await this.backend.time(t);return s.wallMs=Ie()-n,s}track(t){return this.state.activeScope!=null&&(t.scopeId=this.state.activeScope.id,this.state.activeScope.track.push(t)),t}get registeredVariables(){return this.state.registeredVariables}reset(){this.pendingBackendInitId++,this.state.dispose(),this.ENV.reset(),this.state=new er;for(const t in this.registry)this.disposeRegisteredKernels(t),this.registry[t].dispose(),delete this.registry[t];this.backendName=null,this.backendInstance=null,this.pendingBackendInit=null}}ye.nextTensorId=0;ye.nextVariableId=0;function jc(e){const t=ms(Q(e),"float32");return N.makeTensor(t,e,"float32")}function Xr(){const e=Lr();if(e._tfengine==null){const t=new _o(e);e._tfengine=new ye(t)}return Do(e._tfengine.ENV),Rc(()=>e._tfengine),e._tfengine}const N=Xr();function Kc(e,t){const n={a:e,b:t};return N.runKernel(Pr,n)}/**
 * @license
 * Copyright 2017 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Hc(){return typeof navigator<"u"&&navigator!=null}let Hn;function Gc(e){Hn=e}function Mc(e){if(Hn!==void 0)return Hn;if(e||Hc()){if(e||(e=navigator),e.product==="ReactNative")return!0;const t=e.userAgent||e.vendor||(typeof window<"u"?window.opera:"");if(!t){const n=e;return n.userAgentData&&n.userAgentData.mobile}return/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(t)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(t.substr(0,4))}return!1}function Yr(){return typeof window<"u"&&window.document!=null||typeof WorkerGlobalScope<"u"}var U0=Object.freeze({__proto__:null,isBrowser:Yr,isMobile:Mc,mockIsMobile:Gc});/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */const dt=R();dt.registerFlag("DEBUG",()=>!1,e=>{e&&console.warn("Debugging mode is ON. The output of every math call will be downloaded to CPU and checked for NaNs. This significantly impacts performance.")});dt.registerFlag("IS_BROWSER",()=>Yr());dt.registerFlag("IS_NODE",()=>typeof process<"u"&&typeof process.versions<"u"&&typeof process.versions.node<"u");dt.registerFlag("IS_CHROME",()=>typeof navigator<"u"&&navigator!=null&&navigator.userAgent!=null&&/Chrome/.test(navigator.userAgent)&&/Google Inc/.test(navigator.vendor));dt.registerFlag("PROD",()=>!1);dt.registerFlag("TENSORLIKE_CHECK_SHAPE_CONSISTENCY",()=>dt.getBool("DEBUG"));dt.registerFlag("DEPRECATION_WARNINGS_ENABLED",()=>!0);dt.registerFlag("IS_TEST",()=>!1);dt.registerFlag("CHECK_COMPUTATION_FOR_ERRORS",()=>!0);dt.registerFlag("WRAP_TO_IMAGEBITMAP",()=>!1);dt.registerFlag("ENGINE_COMPILE_ONLY",()=>!1);dt.registerFlag("CANVAS2D_WILL_READ_FREQUENTLY_FOR_GPU",()=>!1);dt.registerFlag("USE_SETTIMEOUTCUSTOM",()=>!1);/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Wt(e,t){let n=e;if(Et(e))return t==="string"?[]:[e.length];if(!Array.isArray(e))return[];const s=[];for(;Array.isArray(n)||Et(n)&&t!=="string";)s.push(n.length),n=n[0];return Array.isArray(e)&&R().getBool("TENSORLIKE_CHECK_SHAPE_CONSISTENCY")&&Jr(e,s,[]),s}function Jr(e,t,n){if(n=n||[],!Array.isArray(e)&&!Et(e)){y(t.length===0,()=>`Element arr[${n.join("][")}] is a primitive, but should be an array/TypedArray of ${t[0]} elements`);return}y(t.length>0,()=>`Element arr[${n.join("][")}] should be a primitive, but is an array of ${e.length} elements`),y(e.length===t[0],()=>`Element arr[${n.join("][")}] should have ${t[0]} elements, but has ${e.length} elements`);const s=t.slice(1);for(let r=0;r<e.length;++r)Jr(e[r],s,n.concat(r))}function nr(e,t,n,s){if(e!=="string_or_numeric"){if(e==null)throw new Error("Expected dtype cannot be null.");if(e!=="numeric"&&e!==t||e==="numeric"&&t==="string")throw new Error(`Argument '${n}' passed to '${s}' must be ${e} tensor, but got ${t} tensor`)}}function m(e,t,n,s="numeric"){if(e instanceof Z)return nr(s,e.dtype,t,n),e;let r=mn(e);if(r!=="string"&&["bool","int32","float32"].indexOf(s)>=0&&(r=s),nr(s,r,t,n),e==null||!Et(e)&&!Array.isArray(e)&&typeof e!="number"&&typeof e!="boolean"&&typeof e!="string"){const u=e==null?"null":e.constructor.name;throw new Error(`Argument '${t}' passed to '${n}' must be a Tensor or TensorLike, but got '${u}'`)}const a=Wt(e,r);!Et(e)&&!Array.isArray(e)&&(e=[e]);const i=r!=="string"?gn(e,r):Be(e,[],!0);return N.makeTensor(i,a,r)}function Ae(e,t,n,s="numeric"){if(!Array.isArray(e))throw new Error(`Argument ${t} passed to ${n} must be a \`Tensor[]\` or \`TensorLike[]\``);return e.map((a,o)=>m(a,`${t}[${o}]`,n,s))}/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */const Zr="__op";function b(e){const t=Object.keys(e);if(t.length!==1)throw new Error(`Please provide an object with a single key (operation name) mapping to a function. Got an object with ${t.length} keys.`);let n=t[0];const s=e[n];n.endsWith("_")&&(n=n.substring(0,n.length-1)),n=n+Zr;const r=(...a)=>{N.startScope(n);try{const o=s(...a);return te(o)&&console.error("Cannot return a Promise inside of tidy."),N.endScope(o),o}catch(o){throw N.endScope(null),o}};return Object.defineProperty(r,"name",{value:n,configurable:!0}),r}/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Xc(e,t){const n=m(e,"real","complex"),s=m(t,"imag","complex");ht(n.shape,s.shape,`real and imag shapes, ${n.shape} and ${s.shape}, must match in call to tf.complex().`);const r={real:n,imag:s};return N.runKernel(ti,r)}const Ut=b({complex_:Xc});/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function jt(e,t,n,s){if(s==null&&(s=mn(e)),s==="complex64")throw new Error("Cannot construct a complex64 tensor directly. Please use tf.complex(real, imag).");if(!Et(e)&&!Array.isArray(e)&&typeof e!="number"&&typeof e!="boolean"&&typeof e!="string")throw new Error("values passed to tensor(values) must be a number/boolean/string or an array of numbers/booleans/strings, or a TypedArray");if(t!=null){ds(t);const r=Q(t),a=Q(n);y(r===a,()=>`Based on the provided shape, [${t}], the tensor should have ${r} values but has ${a}`);for(let o=0;o<n.length;++o){const i=n[o],u=o===n.length-1?i!==Q(t.slice(o)):!0;y(n[o]===t[o]||!u,()=>`Error creating a new Tensor. Inferred shape (${n}) does not match the provided shape (${t}). `)}}return!Et(e)&&!Array.isArray(e)&&(e=[e]),t=t||n,e=s!=="string"?gn(e,s):Be(e,[],!0),N.makeTensor(e,t,s)}/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function xt(e,t,n){const s=Wt(e,n);return jt(e,t,s,n)}/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */const Gn={float32:4,float16:2,int32:4,uint16:2,uint8:1,bool:1,complex64:8};/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */const sn=4;async function Yc(e,t){const n=[],s=[],r=Array.isArray(e)?e.map(o=>o.name):Object.keys(e);for(let o=0;o<r.length;++o){const i=r[o],u=Array.isArray(e)?e[o].tensor:e[i];if(u.dtype!=="float32"&&u.dtype!=="int32"&&u.dtype!=="bool"&&u.dtype!=="string"&&u.dtype!=="complex64")throw new Error(`Unsupported dtype in weight '${i}': ${u.dtype}`);const c={name:i,shape:u.shape,dtype:u.dtype};if(u.dtype==="string"){const h=new Promise(async p=>{const f=await u.bytes(),d=f.reduce((S,$)=>S+$.length,0)+sn*f.length,w=new Uint8Array(d);let T=0;for(let S=0;S<f.length;S++){const $=f[S],O=new Uint8Array(new Uint32Array([$.length]).buffer);w.set(O,T),T+=sn,w.set($,T),T+=$.length}p(w)});s.push(h)}else s.push(u.data());t!=null&&(c.group=t),n.push(c)}const a=await Promise.all(s);return{data:Jc(a),specs:n}}function Qr(e,t){const n={};let s,r=0;for(const a of t){const o=a.name,i=a.dtype,u=a.shape,c=Q(u);let h;if("quantization"in a){const p=a.quantization;if(p.dtype==="uint8"||p.dtype==="uint16"){if(!("min"in p&&"scale"in p))throw new Error(`Weight ${a.name} with quantization ${p.dtype} doesn't have corresponding metadata min and scale.`)}else if(p.dtype==="float16"){if(i!=="float32")throw new Error(`Weight ${a.name} is quantized with ${p.dtype} which only supports weights of type float32 not ${i}.`)}else throw new Error(`Weight ${a.name} has unknown quantization dtype ${p.dtype}. Supported quantization dtypes are: 'uint8', 'uint16', and 'float16'.`);const f=Gn[p.dtype],d=e.slice(r,r+c*f),w=p.dtype==="uint8"?new Uint8Array(d):new Uint16Array(d);if(i==="float32")if(p.dtype==="uint8"||p.dtype==="uint16"){h=new Float32Array(w.length);for(let T=0;T<w.length;T++){const S=w[T];h[T]=S*p.scale+p.min}}else if(p.dtype==="float16")s===void 0&&(s=sl()),h=s(w);else throw new Error(`Unsupported quantization type ${p.dtype} for weight type float32.`);else if(i==="int32"){if(p.dtype!=="uint8"&&p.dtype!=="uint16")throw new Error(`Unsupported quantization type ${p.dtype} for weight type int32.`);h=new Int32Array(w.length);for(let T=0;T<w.length;T++){const S=w[T];h[T]=Math.round(S*p.scale+p.min)}}else throw new Error(`Unsupported dtype in weight '${o}': ${i}`);r+=c*f}else if(i==="string"){const p=Q(a.shape);h=[];for(let f=0;f<p;f++){const d=new Uint32Array(e.slice(r,r+sn))[0];r+=sn;const w=new Uint8Array(e.slice(r,r+d));h.push(w),r+=d}}else{const p=Gn[i],f=e.slice(r,r+c*p);if(i==="float32")h=new Float32Array(f);else if(i==="int32")h=new Int32Array(f);else if(i==="bool")h=new Uint8Array(f);else if(i==="complex64"){h=new Float32Array(f);const d=new Float32Array(h.length/2),w=new Float32Array(h.length/2);for(let $=0;$<d.length;$++)d[$]=h[$*2],w[$]=h[$*2+1];const T=xt(d,u,"float32"),S=xt(w,u,"float32");n[o]=Ut(T,S),T.dispose(),S.dispose()}else throw new Error(`Unsupported dtype in weight '${o}': ${i}`);r+=c*p}i!=="complex64"&&(n[o]=xt(h,u,i))}return n}function Jc(e){if(e===null)throw new Error(`Invalid input value: ${JSON.stringify(e)}`);let t=0;const n=[];e.forEach(a=>{if(t+=a.byteLength,n.push(a.byteLength===a.buffer.byteLength?a:new a.constructor(a)),!(a instanceof Float32Array||a instanceof Int32Array||a instanceof Uint8Array))throw new Error(`Unsupported TypedArray subtype: ${a.constructor.name}`)});const s=new Uint8Array(t);let r=0;return n.forEach(a=>{s.set(new Uint8Array(a.buffer),r),r+=a.byteLength}),s.buffer}const Ns=typeof Buffer<"u"&&(typeof Blob>"u"||typeof atob>"u"||typeof btoa>"u");function sr(e){return Ns?Buffer.byteLength(e):new Blob([e]).size}function Zc(e){if(Ns)return Buffer.from(e).toString("base64");const t=new Uint8Array(e);let n="";for(let s=0,r=t.length;s<r;s++)n+=String.fromCharCode(t[s]);return btoa(n)}function Qc(e){if(Ns){const s=Buffer.from(e,"base64");return s.buffer.slice(s.byteOffset,s.byteOffset+s.byteLength)}const t=atob(e),n=new Uint8Array(t.length);for(let s=0;s<t.length;++s)n.set([t.charCodeAt(s)],s);return n.buffer}function Ts(e){if(e.length===1)return e[0];let t=0;e.forEach(r=>{t+=r.byteLength});const n=new Uint8Array(t);let s=0;return e.forEach(r=>{n.set(new Uint8Array(r),s),s+=r.byteLength}),n.buffer}function rr(e){for(e=e.trim();e.endsWith("/");)e=e.slice(0,e.length-1);const n=e.split("/");return n[n.length-1]}function ta(e,t){const n={modelTopology:e.modelTopology,format:e.format,generatedBy:e.generatedBy,convertedBy:e.convertedBy,weightsManifest:t};return e.signature!=null&&(n.signature=e.signature),e.userDefinedMetadata!=null&&(n.userDefinedMetadata=e.userDefinedMetadata),e.modelInitializer!=null&&(n.modelInitializer=e.modelInitializer),e.trainingConfig!=null&&(n.trainingConfig=e.trainingConfig),n}function Ss(e,t,n){const s={modelTopology:e.modelTopology,format:e.format,generatedBy:e.generatedBy,convertedBy:e.convertedBy};if(e.trainingConfig!=null&&(s.trainingConfig=e.trainingConfig),e.weightsManifest!=null){if(!t)throw new Error("modelJSON has weightsManifest but weightSpecs is null");if(!n)throw new Error("modelJSON has weightsManifest but weightData is null");s.weightSpecs=t,s.weightData=n}return e.signature!=null&&(s.signature=e.signature),e.userDefinedMetadata!=null&&(s.userDefinedMetadata=e.userDefinedMetadata),e.modelInitializer!=null&&(s.modelInitializer=e.modelInitializer),s}async function $s(e,t){let n,s;return e.weightsManifest!=null&&([n,s]=await t(e.weightsManifest)),Ss(e,n,s)}function ze(e){if(e.modelTopology instanceof ArrayBuffer)throw new Error("Expected JSON model topology, received ArrayBuffer.");return{dateSaved:new Date,modelTopologyType:"JSON",modelTopologyBytes:e.modelTopology==null?0:sr(JSON.stringify(e.modelTopology)),weightSpecsBytes:e.weightSpecs==null?0:sr(JSON.stringify(e.weightSpecs)),weightDataBytes:e.weightData==null?0:e.weightData.byteLength}}function ks(e){const t=[];for(const n of e)t.push(...n.weights);return t}function tl(){const e=n=>{let s=n<<13,r=0;for(;(s&8388608)===0;)r-=8388608,s<<=1;return s&=-8388609,r+=947912704,s|r},t=new Uint32Array(2048);t[0]=0;for(let n=1;n<1024;n++)t[n]=e(n);for(let n=1024;n<2048;n++)t[n]=939524096+(n-1024<<13);return t}function el(){const e=new Uint32Array(64);e[0]=0,e[31]=1199570944,e[32]=2147483648,e[63]=3347054592;for(let t=1;t<31;t++)e[t]=t<<23;for(let t=33;t<63;t++)e[t]=2147483648+(t-32<<23);return e}function nl(){const e=new Uint32Array(64);for(let t=0;t<64;t++)e[t]=1024;return e[0]=e[32]=0,e}function sl(){const e=tl(),t=el(),n=nl();return s=>{const r=new ArrayBuffer(4*s.length),a=new Uint32Array(r);for(let o=0;o<s.length;o++){const i=s[o],u=e[n[i>>10]+(i&1023)]+t[i>>10];a[o]=u}return new Float32Array(r)}}/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */class M{constructor(){this.saveRouters=[],this.loadRouters=[]}static getInstance(){return M.instance==null&&(M.instance=new M),M.instance}static registerSaveRouter(t){M.getInstance().saveRouters.push(t)}static registerLoadRouter(t){M.getInstance().loadRouters.push(t)}static getSaveHandlers(t){return M.getHandlers(t,"save")}static getLoadHandlers(t,n){return M.getHandlers(t,"load",n)}static getHandlers(t,n,s){const r=[];return(n==="load"?M.getInstance().loadRouters:M.getInstance().saveRouters).forEach(o=>{const i=o(t,s);i!==null&&r.push(i)}),r}}const rl=e=>M.registerSaveRouter(e),al=e=>M.registerLoadRouter(e),ol=e=>M.getSaveHandlers(e),il=(e,t)=>M.getLoadHandlers(e,t);/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */const Mn="tensorflowjs",Xn=1,Yt="models_store",Pt="model_info_store";function ea(){if(!R().getBool("IS_BROWSER"))throw new Error("Failed to obtain IndexedDB factory because the current environmentis not a web browser.");const e=typeof window>"u"?self:window,t=e.indexedDB||e.mozIndexedDB||e.webkitIndexedDB||e.msIndexedDB||e.shimIndexedDB;if(t==null)throw new Error("The current browser does not appear to support IndexedDB.");return t}function Yn(e){const t=e.result;t.createObjectStore(Yt,{keyPath:"modelPath"}),t.createObjectStore(Pt,{keyPath:"modelPath"})}class ee{constructor(t){if(this.indexedDB=ea(),t==null||!t)throw new Error("For IndexedDB, modelPath must not be null, undefined or empty.");this.modelPath=t}async save(t){if(t.modelTopology instanceof ArrayBuffer)throw new Error("BrowserLocalStorage.save() does not support saving model topology in binary formats yet.");return this.databaseAction(this.modelPath,t)}async load(){return this.databaseAction(this.modelPath)}databaseAction(t,n){return new Promise((s,r)=>{const a=this.indexedDB.open(Mn,Xn);a.onupgradeneeded=()=>Yn(a),a.onsuccess=()=>{const o=a.result;if(n==null){const i=o.transaction(Yt,"readonly"),c=i.objectStore(Yt).get(this.modelPath);c.onsuccess=()=>{if(c.result==null)return o.close(),r(new Error(`Cannot find model with path '${this.modelPath}' in IndexedDB.`));s(c.result.modelArtifacts)},c.onerror=h=>(o.close(),r(c.error)),i.oncomplete=()=>o.close()}else{const i=ze(n),u=o.transaction(Pt,"readwrite");let c=u.objectStore(Pt);const h=c.put({modelPath:this.modelPath,modelArtifactsInfo:i});let p;h.onsuccess=()=>{p=o.transaction(Yt,"readwrite");const d=p.objectStore(Yt).put({modelPath:this.modelPath,modelArtifacts:n,modelArtifactsInfo:i});d.onsuccess=()=>s({modelArtifactsInfo:i}),d.onerror=w=>{c=u.objectStore(Pt);const T=c.delete(this.modelPath);T.onsuccess=()=>(o.close(),r(d.error)),T.onerror=S=>(o.close(),r(d.error))}},h.onerror=f=>(o.close(),r(h.error)),u.oncomplete=()=>{p==null?o.close():p.oncomplete=()=>o.close()}}},a.onerror=o=>r(a.error)})}}ee.URL_SCHEME="indexeddb://";const na=e=>R().getBool("IS_BROWSER")&&!Array.isArray(e)&&e.startsWith(ee.URL_SCHEME)?ul(e.slice(ee.URL_SCHEME.length)):null;M.registerSaveRouter(na);M.registerLoadRouter(na);function ul(e){return new ee(e)}function cl(e){return e.startsWith(ee.URL_SCHEME)?e.slice(ee.URL_SCHEME.length):e}class ll{constructor(){this.indexedDB=ea()}async listModels(){return new Promise((t,n)=>{const s=this.indexedDB.open(Mn,Xn);s.onupgradeneeded=()=>Yn(s),s.onsuccess=()=>{const r=s.result,a=r.transaction(Pt,"readonly"),i=a.objectStore(Pt).getAll();i.onsuccess=()=>{const u={};for(const c of i.result)u[c.modelPath]=c.modelArtifactsInfo;t(u)},i.onerror=u=>(r.close(),n(i.error)),a.oncomplete=()=>r.close()},s.onerror=r=>n(s.error)})}async removeModel(t){return t=cl(t),new Promise((n,s)=>{const r=this.indexedDB.open(Mn,Xn);r.onupgradeneeded=()=>Yn(r),r.onsuccess=()=>{const a=r.result,o=a.transaction(Pt,"readwrite"),i=o.objectStore(Pt),u=i.get(t);let c;u.onsuccess=()=>{if(u.result==null)return a.close(),s(new Error(`Cannot find model with path '${t}' in IndexedDB.`));{const h=i.delete(t),p=()=>{c=a.transaction(Yt,"readwrite");const d=c.objectStore(Yt).delete(t);d.onsuccess=()=>n(u.result.modelArtifactsInfo),d.onerror=w=>s(u.error)};h.onsuccess=p,h.onerror=f=>(p(),a.close(),s(u.error))}},u.onerror=h=>(a.close(),s(u.error)),o.oncomplete=()=>{c==null?a.close():c.oncomplete=()=>a.close()}},r.onerror=a=>s(r.error)})}}/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */const At="/",le="tensorflowjs_models",sa="info",pl="model_topology",hl="weight_specs",fl="weight_data",ml="model_metadata";function ra(e){return{info:[le,e,sa].join(At),topology:[le,e,pl].join(At),weightSpecs:[le,e,hl].join(At),weightData:[le,e,fl].join(At),modelMetadata:[le,e,ml].join(At)}}function aa(e){for(const t of Object.values(e))window.localStorage.removeItem(t)}function dl(e){const t=e.split(At);if(t.length<3)throw new Error(`Invalid key format: ${e}`);return t.slice(1,t.length-1).join(At)}function gl(e){return e.startsWith(ne.URL_SCHEME)?e.slice(ne.URL_SCHEME.length):e}class ne{constructor(t){if(!R().getBool("IS_BROWSER")||typeof window>"u"||typeof window.localStorage>"u")throw new Error("The current environment does not support local storage.");if(this.LS=window.localStorage,t==null||!t)throw new Error("For local storage, modelPath must not be null, undefined or empty.");this.modelPath=t,this.keys=ra(this.modelPath)}async save(t){if(t.modelTopology instanceof ArrayBuffer)throw new Error("BrowserLocalStorage.save() does not support saving model topology in binary formats yet.");{const n=JSON.stringify(t.modelTopology),s=JSON.stringify(t.weightSpecs),r=ze(t);try{this.LS.setItem(this.keys.info,JSON.stringify(r)),this.LS.setItem(this.keys.topology,n),this.LS.setItem(this.keys.weightSpecs,s),this.LS.setItem(this.keys.weightData,Zc(t.weightData));const a={format:t.format,generatedBy:t.generatedBy,convertedBy:t.convertedBy,signature:t.signature!=null?t.signature:void 0,userDefinedMetadata:t.userDefinedMetadata!=null?t.userDefinedMetadata:void 0,modelInitializer:t.modelInitializer!=null?t.modelInitializer:void 0,trainingConfig:t.trainingConfig!=null?t.trainingConfig:void 0};return this.LS.setItem(this.keys.modelMetadata,JSON.stringify(a)),{modelArtifactsInfo:r}}catch{throw aa(this.keys),new Error(`Failed to save model '${this.modelPath}' to local storage: size quota being exceeded is a possible cause of this failure: modelTopologyBytes=${r.modelTopologyBytes}, weightSpecsBytes=${r.weightSpecsBytes}, weightDataBytes=${r.weightDataBytes}.`)}}}async load(){const t=JSON.parse(this.LS.getItem(this.keys.info));if(t==null)throw new Error(`In local storage, there is no model with name '${this.modelPath}'`);if(t.modelTopologyType!=="JSON")throw new Error("BrowserLocalStorage does not support loading non-JSON model topology yet.");const n={},s=JSON.parse(this.LS.getItem(this.keys.topology));if(s==null)throw new Error(`In local storage, the topology of model '${this.modelPath}' is missing.`);n.modelTopology=s;const r=JSON.parse(this.LS.getItem(this.keys.weightSpecs));if(r==null)throw new Error(`In local storage, the weight specs of model '${this.modelPath}' are missing.`);n.weightSpecs=r;const a=this.LS.getItem(this.keys.modelMetadata);if(a!=null){const i=JSON.parse(a);n.format=i.format,n.generatedBy=i.generatedBy,n.convertedBy=i.convertedBy,i.signature!=null&&(n.signature=i.signature),i.userDefinedMetadata!=null&&(n.userDefinedMetadata=i.userDefinedMetadata),i.modelInitializer!=null&&(n.modelInitializer=i.modelInitializer),i.trainingConfig!=null&&(n.trainingConfig=i.trainingConfig)}const o=this.LS.getItem(this.keys.weightData);if(o==null)throw new Error(`In local storage, the binary weight values of model '${this.modelPath}' are missing.`);return n.weightData=Qc(o),n}}ne.URL_SCHEME="localstorage://";const oa=e=>R().getBool("IS_BROWSER")&&!Array.isArray(e)&&e.startsWith(ne.URL_SCHEME)?yl(e.slice(ne.URL_SCHEME.length)):null;M.registerSaveRouter(oa);M.registerLoadRouter(oa);function yl(e){return new ne(e)}class bl{constructor(){y(R().getBool("IS_BROWSER"),()=>"Current environment is not a web browser"),y(typeof window>"u"||typeof window.localStorage<"u",()=>"Current browser does not appear to support localStorage"),this.LS=window.localStorage}async listModels(){const t={},n=le+At,s=At+sa;for(let r=0;r<this.LS.length;++r){const a=this.LS.key(r);if(a.startsWith(n)&&a.endsWith(s)){const o=dl(a);t[o]=JSON.parse(this.LS.getItem(a))}}return t}async removeModel(t){t=gl(t);const n=ra(t);if(this.LS.getItem(n.info)==null)throw new Error(`Cannot find model at path '${t}'`);const s=JSON.parse(this.LS.getItem(n.info));return aa(n),s}}/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */const pe="://";class it{constructor(){this.managers={}}static getInstance(){return it.instance==null&&(it.instance=new it),it.instance}static registerManager(t,n){y(t!=null,()=>"scheme must not be undefined or null."),t.endsWith(pe)&&(t=t.slice(0,t.indexOf(pe))),y(t.length>0,()=>"scheme must not be an empty string.");const s=it.getInstance();y(s.managers[t]==null,()=>`A model store manager is already registered for scheme '${t}'.`),s.managers[t]=n}static getManager(t){const n=it.getInstance().managers[t];if(n==null)throw new Error(`Cannot find model manager for scheme '${t}'`);return n}static getSchemes(){return Object.keys(it.getInstance().managers)}}function Ke(e){if(e.indexOf(pe)===-1)throw new Error(`The url string provided does not contain a scheme. Supported schemes are: ${it.getSchemes().join(",")}`);return{scheme:e.split(pe)[0],path:e.split(pe)[1]}}async function ia(e,t,n=!1){y(e!==t,()=>`Old path and new path are the same: '${e}'`);const s=M.getLoadHandlers(e);y(s.length>0,()=>`Copying failed because no load handler is found for source URL ${e}.`),y(s.length<2,()=>`Copying failed because more than one (${s.length}) load handlers for source URL ${e}.`);const r=s[0],a=M.getSaveHandlers(t);y(a.length>0,()=>`Copying failed because no save handler is found for destination URL ${t}.`),y(a.length<2,()=>`Copying failed because more than one (${s.length}) save handlers for destination URL ${t}.`);const o=a[0],i=Ke(e).scheme,u=Ke(e).path,c=i===Ke(e).scheme,h=await r.load();n&&c&&await it.getManager(i).removeModel(u);const p=await o.save(h);return n&&!c&&await it.getManager(i).removeModel(u),p.modelArtifactsInfo}async function wl(){const e=it.getSchemes(),t={};for(const n of e){const s=await it.getManager(n).listModels();for(const r in s){const a=n+pe+r;t[a]=s[r]}}return t}async function Nl(e){const t=Ke(e);return it.getManager(t.scheme).removeModel(t.path)}async function Tl(e,t){return ia(e,t,!1)}async function Sl(e,t){return ia(e,t,!0)}/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */class $l{constructor(){this.messageName="setTimeoutCustom",this.functionRefs=[],this.handledMessageCount=0,this.hasEventListener=!1}fetch(t,n){return fetch(t,n)}now(){return performance.now()}encode(t,n){if(n!=="utf-8"&&n!=="utf8")throw new Error(`Browser's encoder only supports utf-8, but got ${n}`);return this.textEncoder==null&&(this.textEncoder=new TextEncoder),this.textEncoder.encode(t)}decode(t,n){return new TextDecoder(n).decode(t)}setTimeoutCustom(t,n){if(!window||!R().getBool("USE_SETTIMEOUTCUSTOM")){setTimeout(t,n);return}this.functionRefs.push(t),setTimeout(()=>{window.postMessage({name:this.messageName,index:this.functionRefs.length-1},"*")},n),this.hasEventListener||(this.hasEventListener=!0,window.addEventListener("message",s=>{if(s.source===window&&s.data.name===this.messageName){s.stopPropagation();const r=this.functionRefs[s.data.index];r(),this.handledMessageCount++,this.handledMessageCount===this.functionRefs.length&&(this.functionRefs=[],this.handledMessageCount=0)}},!0))}}if(R().get("IS_BROWSER")){R().setPlatform("browser",new $l);try{it.registerManager(ne.URL_SCHEME,new bl)}catch{}try{it.registerManager(ee.URL_SCHEME,new ll)}catch{}}/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */const kl={importFetch:()=>require("node-fetch")};let Fn;class El{constructor(){this.util=require("util"),this.textEncoder=new this.util.TextEncoder}fetch(t,n){return R().global.fetch!=null?R().global.fetch(t,n):(Fn==null&&(Fn=kl.importFetch()),Fn(t,n))}now(){const t=process.hrtime();return t[0]*1e3+t[1]/1e6}encode(t,n){if(n!=="utf-8"&&n!=="utf8")throw new Error(`Node built-in encoder only supports utf-8, but got ${n}`);return this.textEncoder.encode(t)}decode(t,n){return t.length===0?"":new this.util.TextDecoder(n).decode(t)}}R().get("IS_NODE")&&!R().get("IS_BROWSER")&&R().setPlatform("node",new El);/**
 * @license
 * Copyright 2020 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Ft(e,t="float32",n){return t=t||"float32",ds(e),new qn(e,t,n)}/**
 * @license
 * Copyright 2020 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function vl(e,t){const n=m(e,"x","cast");if(!Ar(t))throw new Error(`Failed to cast to unknown dtype ${t}`);if(t==="string"&&n.dtype!=="string"||t!=="string"&&n.dtype==="string")throw new Error("Only strings can be casted to strings");const s={x:n},r={dtype:t};return N.runKernel(Rr,s,r)}const st=b({cast_:vl});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function _l(e){const n={x:m(e,"x","clone","string_or_numeric")};return N.runKernel(zr,n)}const Vt=b({clone_:_l});/**
 * @license
 * Copyright 2020 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function ua(e,t=!1){console.log(e.toString(t))}/**
 * @license
 * Copyright 2020 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */Xr();const xl={buffer:Ft,cast:st,clone:Vt,print:ua};zc(xl);/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */const Il="model",Al=".json",Dl=".weights.bin";function ar(e){return new Promise(t=>setTimeout(t)).then(e)}class se{constructor(t){if(!R().getBool("IS_BROWSER"))throw new Error("browserDownloads() cannot proceed because the current environment is not a browser.");t.startsWith(se.URL_SCHEME)&&(t=t.slice(se.URL_SCHEME.length)),(t==null||t.length===0)&&(t=Il),this.modelJsonFileName=t+Al,this.weightDataFileName=t+Dl}async save(t){if(typeof document>"u")throw new Error("Browser downloads are not supported in this environment since `document` is not present");const n=window.URL.createObjectURL(new Blob([t.weightData],{type:"application/octet-stream"}));if(t.modelTopology instanceof ArrayBuffer)throw new Error("BrowserDownloads.save() does not support saving model topology in binary formats yet.");{const s=[{paths:["./"+this.weightDataFileName],weights:t.weightSpecs}],r=ta(t,s),a=window.URL.createObjectURL(new Blob([JSON.stringify(r)],{type:"application/json"})),o=this.modelJsonAnchor==null?document.createElement("a"):this.modelJsonAnchor;if(o.download=this.modelJsonFileName,o.href=a,await ar(()=>o.dispatchEvent(new MouseEvent("click"))),t.weightData!=null){const i=this.weightDataAnchor==null?document.createElement("a"):this.weightDataAnchor;i.download=this.weightDataFileName,i.href=n,await ar(()=>i.dispatchEvent(new MouseEvent("click")))}return{modelArtifactsInfo:ze(t)}}}}se.URL_SCHEME="downloads://";class Ol{constructor(t){if(t==null||t.length<1)throw new Error(`When calling browserFiles, at least 1 file is required, but received ${t}`);this.jsonFile=t[0],this.weightsFiles=t.slice(1)}async load(){return new Promise((t,n)=>{const s=new FileReader;s.onload=r=>{const a=JSON.parse(r.target.result),o=a.modelTopology;if(o==null){n(new Error(`modelTopology field is missing from file ${this.jsonFile.name}`));return}if(a.weightsManifest==null){n(new Error(`weightManifest field is missing from file ${this.jsonFile.name}`));return}if(this.weightsFiles.length===0){t({modelTopology:o});return}const u=$s(a,c=>this.loadWeights(c));t(u)},s.onerror=r=>n(`Failed to read model topology and weights manifest JSON from file '${this.jsonFile.name}'. BrowserFiles supports loading Keras-style tf.Model artifacts only.`),s.readAsText(this.jsonFile)})}loadWeights(t){const n=[],s=[];for(const o of t)n.push(...o.weights),s.push(...o.paths);const r=this.checkManifestAndWeightFiles(t),a=s.map(o=>this.loadWeightsFile(o,r[o]));return Promise.all(a).then(o=>[n,Ts(o)])}loadWeightsFile(t,n){return new Promise((s,r)=>{const a=new FileReader;a.onload=o=>{const i=o.target.result;s(i)},a.onerror=o=>r(`Failed to weights data from file of path '${t}'.`),a.readAsArrayBuffer(n)})}checkManifestAndWeightFiles(t){const n=[],s=this.weightsFiles.map(a=>rr(a.name)),r={};for(const a of t)a.paths.forEach(o=>{const i=rr(o);if(n.indexOf(i)!==-1)throw new Error(`Duplicate file basename found in weights manifest: '${i}'`);if(n.push(i),s.indexOf(i)===-1)throw new Error(`Weight file with basename '${i}' is not provided.`);r[o]=this.weightsFiles[s.indexOf(i)]});if(n.length!==this.weightsFiles.length)throw new Error(`Mismatch in the number of files in weights manifest (${n.length}) and the number of weight files provided (${this.weightsFiles.length}).`);return r}}const Fl=e=>R().getBool("IS_BROWSER")&&!Array.isArray(e)&&e.startsWith(se.URL_SCHEME)?Cl(e.slice(se.URL_SCHEME.length)):null;M.registerSaveRouter(Fl);function Cl(e="model"){return new se(e)}function Bl(e){return new Ol(e)}/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function or(e,t,n,s){o(e),n=n??0,s=s??1,i(n,s);let r=0;const a=u=>(u.then(c=>{const h=n+ ++r/e.length*(s-n);return t(h),c}),u);function o(u){y(u!=null&&Array.isArray(u)&&u.length>0,()=>"promises must be a none empty array")}function i(u,c){y(u>=0&&u<=1,()=>`Progress fraction must be in range [0, 1], but got startFraction ${u}`),y(c>=0&&c<=1,()=>`Progress fraction must be in range [0, 1], but got endFraction ${c}`),y(c>=u,()=>`startFraction must be no more than endFraction, but got startFraction ${u} and endFraction ${c}`)}return Promise.all(e.map(a))}/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */async function ca(e,t){t==null&&(t={});const n=t.fetchFunc==null?R().platform.fetch:t.fetchFunc,s=e.map(p=>n(p,t.requestInit,{isBinary:!0})),i=(t.onProgress==null?await Promise.all(s):await or(s,t.onProgress,0,.5)).map(p=>p.arrayBuffer());return t.onProgress==null?await Promise.all(i):await or(i,t.onProgress,.5,1)}async function Ll(e,t="",n,s){return la(o=>ca(o,{requestInit:s}))(e,t,n)}function la(e){return async(t,n="",s)=>{const r=t.map(()=>!1),a={},o=s!=null?s.map(()=>!1):[],i=[];if(t.forEach((d,w)=>{let T=0;d.weights.forEach(S=>{const $="quantization"in S?S.quantization.dtype:S.dtype,O=Gn[$]*Q(S.shape),I=()=>{r[w]=!0,a[w]==null&&(a[w]=[]),a[w].push({manifestEntry:S,groupOffset:T,sizeBytes:O})};s!=null?s.forEach((_,A)=>{_===S.name&&(I(),o[A]=!0)}):I(),i.push(S.name),T+=O})}),!o.every(d=>d)){const d=s.filter((w,T)=>!o[T]);throw new Error(`Could not find weights in manifest with names: ${d.join(", ")}. 
Manifest JSON has weights with names: ${i.join(", ")}.`)}const u=r.reduce((d,w,T)=>(w&&d.push(T),d),[]),c=[];u.forEach(d=>{t[d].paths.forEach(w=>{const T=n+(n.endsWith("/")?"":"/")+w;c.push(T)})});const h=await e(c),p={};let f=0;return u.forEach(d=>{const w=t[d].paths.length;let T=0;for(let _=0;_<w;_++)T+=h[f+_].byteLength;const S=new ArrayBuffer(T),$=new Uint8Array(S);let O=0;for(let _=0;_<w;_++){const A=new Uint8Array(h[f+_]);$.set(A,O),O+=A.byteLength}a[d].forEach(_=>{const A=S.slice(_.groupOffset,_.groupOffset+_.sizeBytes),D=Qr(A,[_.manifestEntry]);for(const B in D)p[B]=D[B]}),f+=w}),p}}/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */const Pl="application/octet-stream",Rl="application/json";class Es{constructor(t,n){if(this.DEFAULT_METHOD="POST",n==null&&(n={}),this.weightPathPrefix=n.weightPathPrefix,this.onProgress=n.onProgress,this.weightUrlConverter=n.weightUrlConverter,n.fetchFunc!=null?(y(typeof n.fetchFunc=="function",()=>"Must pass a function that matches the signature of `fetch` (see https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)"),this.fetch=n.fetchFunc):this.fetch=R().platform.fetch,y(t!=null&&t.length>0,()=>"URL path for http must not be null, undefined or empty."),Array.isArray(t)&&y(t.length===2,()=>`URL paths for http must have a length of 2, (actual length is ${t.length}).`),this.path=t,n.requestInit!=null&&n.requestInit.body!=null)throw new Error("requestInit is expected to have no pre-existing body, but has one.");this.requestInit=n.requestInit||{}}async save(t){if(t.modelTopology instanceof ArrayBuffer)throw new Error("BrowserHTTPRequest.save() does not support saving model topology in binary formats yet.");const n=Object.assign({method:this.DEFAULT_METHOD},this.requestInit);n.body=new FormData;const s=[{paths:["./model.weights.bin"],weights:t.weightSpecs}],r=ta(t,s);n.body.append("model.json",new Blob([JSON.stringify(r)],{type:Rl}),"model.json"),t.weightData!=null&&n.body.append("model.weights.bin",new Blob([t.weightData],{type:Pl}),"model.weights.bin");const a=await this.fetch(this.path,n);if(a.ok)return{modelArtifactsInfo:ze(t),responses:[a]};throw new Error(`BrowserHTTPRequest.save() failed due to HTTP response status ${a.status}.`)}async load(){const t=await this.fetch(this.path,this.requestInit);if(!t.ok)throw new Error(`Request to ${this.path} failed with status code ${t.status}. Please verify this URL points to the model JSON of the model to load.`);let n;try{n=await t.json()}catch{let o=`Failed to parse model JSON of response from ${this.path}.`;throw this.path.endsWith(".pb")?o+=" Your path contains a .pb file extension. Support for .pb models have been removed in TensorFlow.js 1.0 in favor of .json models. You can re-convert your Python TensorFlow model using the TensorFlow.js 1.0 conversion scripts or you can convert your.pb models with the 'pb2json'NPM script in the tensorflow/tfjs-converter repository.":o+=" Please make sure the server is serving valid JSON for this request.",new Error(o)}const s=n.modelTopology,r=n.weightsManifest;if(s==null&&r==null)throw new Error(`The JSON from HTTP path ${this.path} contains neither model topology or manifest for weights.`);return $s(n,a=>this.loadWeights(a))}async loadWeights(t){const n=Array.isArray(this.path)?this.path[1]:this.path,[s,r]=zl(n),a=this.weightPathPrefix||s,o=ks(t),i=[],u=[];for(const h of t)for(const p of h.paths)this.weightUrlConverter!=null?u.push(this.weightUrlConverter(p)):i.push(a+p+r);this.weightUrlConverter&&i.push(...await Promise.all(u));const c=await ca(i,{requestInit:this.requestInit,fetchFunc:this.fetch,onProgress:this.onProgress});return[o,Ts(c)]}}Es.URL_SCHEME_REGEX=/^https?:\/\//;function zl(e){const t=e.lastIndexOf("/"),n=e.lastIndexOf("?"),s=e.substring(0,t),r=n>t?e.substring(n):"";return[s+"/",r]}function Jn(e){return e.match(Es.URL_SCHEME_REGEX)!=null}const pa=(e,t)=>{if(typeof fetch>"u"&&(t==null||t.fetchFunc==null))return null;{let n=!0;if(Array.isArray(e)?n=e.every(s=>Jn(s)):n=Jn(e),n)return vs(e,t)}return null};M.registerSaveRouter(pa);M.registerLoadRouter(pa);function vs(e,t){return new Es(e,t)}function Vl(e,t){return vs(e,t)}/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */class Cn{constructor(t){this.modelArtifacts=t}load(){return this.modelArtifacts}}class ha{constructor(t){this.saveHandler=t}save(t){return this.saveHandler(t)}}class ql{constructor(t){t.load&&(this.load=()=>Promise.resolve(t.load())),t.save&&(this.save=n=>Promise.resolve(t.save(n)))}}function Ul(e,t,n,s){const r=arguments;return new ql(rn(...r))}function rn(e,t,n,s){return arguments.length===1?e.modelTopology!=null||e.weightSpecs!=null?new Cn(e):(console.warn("Please call tf.io.fromMemory() with only one argument. The argument should be of type ModelArtifacts. The multi-argument signature of tf.io.fromMemory() has been deprecated and will be removed in a future release."),new Cn({modelTopology:e})):(console.warn("Please call tf.io.fromMemory() with only one argument. The argument should be of type ModelArtifacts. The multi-argument signature of tf.io.fromMemory() has been deprecated and will be removed in a future release."),new Cn({modelTopology:e,weightSpecs:t,weightData:n,trainingConfig:s}))}function Wl(e){return new ha(e)}function jl(e){return new ha(e)}/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */var fa=Object.freeze({__proto__:null,browserFiles:Bl,browserHTTPRequest:Vl,concatenateArrayBuffers:Ts,copyModel:Tl,decodeWeights:Qr,encodeWeights:Yc,fromMemory:Ul,fromMemorySync:rn,getLoadHandlers:il,getModelArtifactsForJSON:$s,getModelArtifactsForJSONSync:Ss,getModelArtifactsInfoForJSON:ze,getSaveHandlers:ol,getWeightSpecs:ks,http:vs,isHTTPScheme:Jn,listModels:wl,loadWeights:Ll,moveModel:Sl,registerLoadRouter:al,registerSaveRouter:rl,removeModel:Nl,weightsLoaderFactory:la,withSaveHandler:Wl,withSaveHandlerSync:jl});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Kl(e,t,n=!1,s=!1){let r=m(e,"a","matMul"),a=m(t,"b","matMul");[r,a]=X(r,a);const o={a:r,b:a},i={transposeA:n,transposeB:s};return N.runKernel(Mo,o,i)}const W=b({matMul_:Kl});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Hl(e,t,n=1,s=0,r="int32"){if(t<2)throw new Error(`Error in oneHot: depth must be >=2, but it is ${t}`);const o={indices:m(e,"indices","oneHot","int32")},i={dtype:r,depth:t,onValue:n,offValue:s};return N.runKernel(yu,o,i)}const Gl=b({oneHot_:Hl});/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function W0(){R().set("PROD",!0)}function j0(){R().set("DEBUG",!0)}function K0(){R().set("DEPRECATION_WARNINGS_ENABLED",!1),console.warn("TensorFlow.js deprecation warnings have been disabled.")}function H0(e){R().getBool("DEPRECATION_WARNINGS_ENABLED")&&console.warn(e+" You can disable deprecation warnings with tf.disableDeprecationWarnings().")}function G0(){N.disposeVariables()}function M0(){return N}function X0(){return N.memory()}function Y0(e){return N.profile(e)}function kt(e,t){return N.tidy(e,t)}function Ml(e){ws(e).forEach(n=>n.dispose())}function Rt(e){return N.keep(e)}function J0(e){return N.time(e)}function Z0(e){return N.setBackend(e)}function Q0(){return N.ready()}function t1(){return N.backendName}function e1(e){N.removeBackend(e)}function n1(e){return N.findBackend(e)}function s1(e){return N.findBackendFactory(e)}function r1(e,t,n=1){return N.registerBackend(e,t,n)}function a1(){return N.backend}function o1(e,t){R().setPlatform(e,t)}/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Xl(e){const n={input:m(e,"input","imag")};return N.runKernel(zi,n)}const yn=b({imag_:Xl});/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Yl(e){const n={x:m(e,"x","neg")};return N.runKernel(pu,n)}const Dt=b({neg_:Yl});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Jl(e){const n={input:m(e,"input","real")};return N.runKernel(vu,n)}const De=b({real_:Jl});/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Zl(e,t,n){const s=m(e,"x","transpose");if(t==null&&(t=s.shape.map((o,i)=>i).reverse()),y(s.rank===t.length,()=>`Error in transpose: rank of input ${s.rank} must match length of perm ${t}.`),t.forEach(o=>{y(o>=0&&o<s.rank,()=>`All entries in 'perm' must be between 0 and ${s.rank-1} but got ${t}`)}),s.rank<=1)return s.clone();const r={x:s},a={perm:t};return s.dtype==="complex64"?kt(()=>{let o=De(s),i=yn(s);return o=N.runKernel(In,{x:o},a),i=N.runKernel(In,{x:i},a),n&&(i=Dt(i)),Ut(o,i)}):N.runKernel(In,r,a)}const Zn=b({transpose_:Zl});/**
 * @license
 * Copyright 2017 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Ql(e,t){const n=e.length,s=[];for(let r=0;r<n;r++){const a=n-1-r,o=e[a]||1;(t[t.length-1-r]||1)>1&&o===1&&s.unshift(a)}return s}function ma(e,t){const n=[];for(let s=0;s<t.length;s++){const r=e[e.length-s-1],a=t.length-s-1,o=t[a];(r==null||r===1&&o>1)&&n.unshift(a)}return n}function tt(e,t){const n=[],s=Math.max(e.length,t.length);for(let r=0;r<s;r++){let a=e[e.length-r-1];a==null&&(a=1);let o=t[t.length-r-1];if(o==null&&(o=1),a===1)n.unshift(o);else if(o===1)n.unshift(a);else if(a!==o){const i=`Operands could not be broadcast together with shapes ${e} and ${t}.`;throw Error(i)}else n.unshift(a)}return n}var i1=Object.freeze({__proto__:null,assertAndGetBroadcastShape:tt,getBroadcastDims:Ql,getReductionAxes:ma});/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function tp(e,t,n){if(ie(e),t!=null&&t.length!==3)throw new Error("tensor3d() requires shape to have three numbers");const s=Wt(e,n);if(s.length!==3&&s.length!==1)throw new Error("tensor3d() requires values to be number[][][] or flat/TypedArray");if(s.length===1&&t==null)throw new Error("tensor3d() requires shape to be provided when `values` are a flat array");return jt(e,t,s,n)}function da(e,t,n){const s=t.rank>1?t.shape[t.rank-1]:1,r=t.rank>1?t.rank-1:1,a=`Must have updates.shape = indices.shape[:batchDim] + shape[sliceDim:], got updates.shape: ${n.shape}, indices.shape: ${t.shape}, shape: ${e}, sliceDim: ${s}, and batchDim: ${r}.`;if(n.rank<r)throw new Error(a+` update.rank < ${r}. `);if(e.length<s+(n.rank-r))throw new Error(a+` Output shape length < ${s+(n.rank-r)}`);if(n.rank!==r+e.length-s)throw new Error(a+` update.rank != ${r+e.length-s}`);for(let o=0;o<r;++o)if(n.shape[o]!==t.shape[o])throw new Error(a+` updates.shape[${o}] (${n.shape[o]}) != indices.shape[${o}] (${t.shape[o]}).`);for(let o=0;o<n.rank-r;++o)if(n.shape[o+r]!==e[o+s])throw new Error(a+` updates.shape[${o+r}] (${n.shape[o+r]}) != shape[${o+r}] (${e[o+r]})`)}function ga(e,t,n){if(t.rank<1)throw new Error(`tf.scatterND() expects the indices to be rank 1 or higher, but the rank was ${t.rank}.`);if(e.rank<1)throw new Error(`tf.scatterND() expects the updates to be rank 1 or higher, but the rank was ${e.rank}.`);if(t.dtype!=="int32")throw new Error(`The dtype of 'indices' should be int32, but got dtype: ${t.dtype}`);if(n.length<1)throw new Error(`Output rank must be greater or equal to 1, but got shape: ${n}`);if(n.length===0){if(t.size===0)throw new Error(`Indices specified for empty output. indices shape: ${t.shape}`);if(e.size===0)throw new Error(`Updates specified for empty output. updates shape: ${e.shape}`)}da(n,t,e)}function ep(e,t,n){const s=t.shape.length,r=s>1?t.shape[s-1]:1,a=n.length;let o=1;for(let p=r;p<a;++p)o*=n[p];const i=r<1?1:r,u=Q(t.shape)/i,c=[...Pe(n.slice(0,r)),1],h=Q(n);return{sliceRank:r,numUpdates:u,sliceSize:o,strides:c,outputSize:h}}var u1=Object.freeze({__proto__:null,calculateShapes:ep,validateInput:ga,validateUpdateShape:da});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function np(e,t){let n=m(e,"a","add"),s=m(t,"b","add");[n,s]=X(n,s);const r={a:n,b:s};return N.runKernel(Pr,r)}const rt=b({add_:np});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function sp(e,t){let n=m(e,"a","floorDiv"),s=m(t,"b","floorDiv");[n,s]=X(n,s);const r={a:n,b:s};return N.runKernel(Oi,r)}const ya=b({floorDiv_:sp});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function rp(e,t){let n=m(e,"a","div"),s=m(t,"b","div");if([n,s]=X(n,s),n.dtype==="int32"&&s.dtype==="int32")return ya(n,s);const r={a:n,b:s},a={};return N.runKernel(Ni,r,a)}const lt=b({div_:rp});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function ap(e,t){let n=m(e,"a","mul"),s=m(t,"b","mul");[n,s]=X(n,s);const r={a:n,b:s};return N.runKernel(lu,r)}const z=b({mul_:ap});/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function op(e){const t=m(e,"x","abs");if(t.dtype==="complex64"){const n={x:t};return N.runKernel(ei,n)}else{const n={x:t};return N.runKernel(Fo,n)}}const Nt=b({abs_:op});/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function ip(e){const n={x:m(e,"x","acos")};return N.runKernel(Co,n)}const up=b({acos_:ip});/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function cp(e){const n={x:m(e,"x","acosh")};return N.runKernel(Bo,n)}const lp=b({acosh_:cp});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function pp(e){y(Array.isArray(e),()=>"The argument passed to tf.addN() must be a list of tensors"),y(e.length>=1,()=>`Must pass at least one tensor to tf.addN(), but got ${e.length}`);const t=e.map((r,a)=>m(r,`tensors${a}`,"addN")),n=t[0];t.forEach(r=>{if(r.dtype!==n.dtype)throw new Error("All tensors passed to tf.addN() must have the same dtype")}),t.forEach(r=>{if(!Ot(r.shape,n.shape))throw new Error("All tensors passed to tf.addN() must have the same shape")});const s=t;return N.runKernel(Lo,s)}const hp=b({addN_:pp});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function fp(e,t=null,n=!1){const r={x:m(e,"x","all","bool")},a={axis:t,keepDims:n};return N.runKernel(Po,r,a)}const mp=b({all_:fp});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function dp(e,t=null,n=!1){const r={x:m(e,"x","any","bool")},a={axis:t,keepDims:n};return N.runKernel(Ro,r,a)}const gp=b({any_:dp});/**
 * @license
 * Copyright 2020 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function yp(e,t=0){const s={x:m(e,"x","argMax")},r={axis:t};return N.runKernel(zo,s,r)}const bp=b({argMax_:yp});/**
 * @license
 * Copyright 2020 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function wp(e,t=0){const s={x:m(e,"x","argMin")},r={axis:t};return N.runKernel(Vo,s,r)}const Np=b({argMin_:wp});/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Tp(e){const n={x:m(e,"x","asin")};return N.runKernel(qo,n)}const Sp=b({asin_:Tp});/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function $p(e){const n={x:m(e,"x","asinh")};return N.runKernel(Uo,n)}const kp=b({asinh_:$p});/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Ep(e){const n={x:m(e,"x","atan")};return N.runKernel(Wo,n)}const vp=b({atan_:Ep});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function _p(e,t){let n=m(e,"a","atan2"),s=m(t,"b","atan2");[n,s]=X(n,s);const r={a:n,b:s};return N.runKernel(Ko,r)}const xp=b({atan2_:_p});/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Ip(e){const n={x:m(e,"x","atanh")};return N.runKernel(jo,n)}const Ap=b({atanh_:Ip});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function c1(e,t,n,s,r="NHWC",a){const o=e[3],i=[...t,o],u=Pp(r);return bn(e,i,n,a,s,null,null,u)}function Dp(e,t,n,s,r,a,o="channelsLast"){const[i,u]=an(t);let c;if(o==="channelsLast")c=[i,u,e[3],e[3]];else if(o==="channelsFirst")c=[i,u,e[1],e[1]];else throw new Error(`Unknown dataFormat ${o}`);return bn(e,c,n,s,r,a,!1,o)}function l1(e,t,n,s,r,a,o="NDHWC"){const[i,u,c]=Qn(t);let h,p;if(o==="NDHWC")p="channelsLast",h=[i,u,c,e[4],e[4]];else if(o==="NCDHW")p="channelsFirst",h=[i,u,c,e[1],e[1]];else throw new Error(`Unknown dataFormat ${o}`);return Op(e,h,n,s,r,!1,p,a)}function bn(e,t,n,s,r,a,o=!1,i="channelsLast"){let[u,c,h,p]=[-1,-1,-1,-1];if(i==="channelsLast")[u,c,h,p]=e;else if(i==="channelsFirst")[u,p,c,h]=e;else throw new Error(`Unknown dataFormat ${i}`);const[f,d,,w]=t,[T,S]=an(n),[$,O]=an(s),I=he(f,$),_=he(d,O),{padInfo:A,outHeight:D,outWidth:B}=Bp(r,c,h,T,S,I,_,a,i),F=o?w*p:w;let E;return i==="channelsFirst"?E=[u,F,D,B]:i==="channelsLast"&&(E=[u,D,B,F]),{batchSize:u,dataFormat:i,inHeight:c,inWidth:h,inChannels:p,outHeight:D,outWidth:B,outChannels:F,padInfo:A,strideHeight:T,strideWidth:S,filterHeight:f,filterWidth:d,effectiveFilterHeight:I,effectiveFilterWidth:_,dilationHeight:$,dilationWidth:O,inShape:e,outShape:E,filterShape:t}}function Op(e,t,n,s,r,a=!1,o="channelsLast",i){let[u,c,h,p,f]=[-1,-1,-1,-1,-1];if(o==="channelsLast")[u,c,h,p,f]=e;else if(o==="channelsFirst")[u,f,c,h,p]=e;else throw new Error(`Unknown dataFormat ${o}`);const[d,w,T,,S]=t,[$,O,I]=Qn(n),[_,A,D]=Qn(s),B=he(d,_),F=he(w,A),E=he(T,D),{padInfo:k,outDepth:g,outHeight:x,outWidth:C}=Lp(r,c,h,p,$,O,I,B,F,E,i),L=a?S*f:S;let P;return o==="channelsFirst"?P=[u,L,g,x,C]:o==="channelsLast"&&(P=[u,g,x,C,L]),{batchSize:u,dataFormat:o,inDepth:c,inHeight:h,inWidth:p,inChannels:f,outDepth:g,outHeight:x,outWidth:C,outChannels:L,padInfo:k,strideDepth:$,strideHeight:O,strideWidth:I,filterDepth:d,filterHeight:w,filterWidth:T,effectiveFilterDepth:B,effectiveFilterHeight:F,effectiveFilterWidth:E,dilationDepth:_,dilationHeight:A,dilationWidth:D,inShape:e,outShape:P,filterShape:t}}function Fp(e,t,n,s,r){s==null&&(s=ba(e,t,n));const a=e[0],o=e[1],i=Qt((a-t+2*s)/n+1,r),u=Qt((o-t+2*s)/n+1,r);return[i,u]}function Cp(e,t,n,s,r,a){r==null&&(r=ba(e,t,s));const o=e[0],i=e[1],u=e[2],c=Qt((o-t+2*r)/s+1,a),h=Qt((i-t+2*r)/s+1,a),p=Qt((u-t+2*r)/s+1,a);return[c,h,p,n]}function ba(e,t,n,s=1){const r=he(t,s);return Math.floor((e[0]*(n-1)-n+r)/2)}function an(e){return typeof e=="number"?[e,e,e]:e.length===2?[e[0],e[1],1]:e}function Qn(e){return typeof e=="number"?[e,e,e]:e}function he(e,t){return t<=1?e:e+(e-1)*(t-1)}function Bp(e,t,n,s,r,a,o,i,u){let c,h,p;if(typeof e=="number"){c={top:e,bottom:e,left:e,right:e,type:e===0?"VALID":"NUMBER"};const d=Fp([t,n],a,s,e,i);h=d[0],p=d[1]}else if(e==="same"){h=Math.ceil(t/s),p=Math.ceil(n/r);const f=Math.max(0,(h-1)*s+a-t),d=Math.max(0,(p-1)*r+o-n),w=Math.floor(f/2),T=f-w,S=Math.floor(d/2),$=d-S;c={top:w,bottom:T,left:S,right:$,type:"SAME"}}else if(e==="valid")c={top:0,bottom:0,left:0,right:0,type:"VALID"},h=Math.ceil((t-a+1)/s),p=Math.ceil((n-o+1)/r);else if(typeof e=="object"){const f=u==="channelsLast"?e[1][0]:e[2][0],d=u==="channelsLast"?e[1][1]:e[2][1],w=u==="channelsLast"?e[2][0]:e[3][0],T=u==="channelsLast"?e[2][1]:e[3][1];c={top:f,bottom:d,left:w,right:T,type:f===0&&d===0&&w===0&&T===0?"VALID":"EXPLICIT"},h=Qt((t-a+f+d)/s+1,i),p=Qt((n-o+w+T)/r+1,i)}else throw Error(`Unknown padding parameter: ${e}`);return{padInfo:c,outHeight:h,outWidth:p}}function Lp(e,t,n,s,r,a,o,i,u,c,h){let p,f,d,w;if(typeof e=="number"){p={top:e,bottom:e,left:e,right:e,front:e,back:e,type:e===0?"VALID":"NUMBER"};const S=Cp([t,n,s,1],i,1,r,e,h);f=S[0],d=S[1],w=S[2]}else if(e==="same"){f=Math.ceil(t/r),d=Math.ceil(n/a),w=Math.ceil(s/o);const T=(f-1)*r+i-t,S=(d-1)*a+u-n,$=(w-1)*o+c-s,O=Math.floor(T/2),I=T-O,_=Math.floor(S/2),A=S-_,D=Math.floor($/2),B=$-D;p={top:_,bottom:A,left:D,right:B,front:O,back:I,type:"SAME"}}else if(e==="valid")p={top:0,bottom:0,left:0,right:0,front:0,back:0,type:"VALID"},f=Math.ceil((t-i+1)/r),d=Math.ceil((n-u+1)/a),w=Math.ceil((s-c+1)/o);else throw Error(`Unknown padding parameter: ${e}`);return{padInfo:p,outDepth:f,outHeight:d,outWidth:w}}function Qt(e,t){if(!t)return Math.trunc(e);switch(t){case"round":return Math.round(e);case"ceil":return Math.ceil(e);case"floor":return Math.floor(e);default:throw new Error(`Unknown roundingMode ${t}`)}}function on(e){const[t,n,s]=an(e);return t===1&&n===1&&s===1}function Kt(e,t){return on(e)||on(t)}function Pp(e){if(e==="NHWC")return"channelsLast";if(e==="NCHW")return"channelsFirst";throw new Error(`Unknown dataFormat ${e}`)}function vt(e,t,n){if(n!=null){if(typeof t=="string")throw Error(`Error in ${e}: pad must be an integer when using dimRoundingMode ${n} but got pad ${t}.`);if(typeof t=="number")y(de(t),()=>`Error in ${e}: pad must be an integer when using dimRoundingMode ${n} but got pad ${t}.`);else if(typeof t=="object")t.forEach(s=>{s.forEach(r=>{y(de(r),()=>`Error in ${e}: pad must be an integer when using dimRoundingMode ${n} but got pad ${r}.`)})});else throw Error(`Error in ${e}: Unknown padding parameter: ${t}`)}}/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Rp(e,t){const s={x:m(e,"x","reshape","string_or_numeric")},r={shape:t};return N.runKernel(Iu,s,r)}const v=b({reshape_:Rp});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function zp(e,t,n,s,r){const a=m(e,"x","avgPool","float32"),o=1;y(Kt(n,o),()=>`Error in avgPool: Either strides or dilations must be 1. Got strides ${n} and dilations '${o}'`);let i=a,u=!1;a.rank===3&&(u=!0,i=v(a,[1,a.shape[0],a.shape[1],a.shape[2]])),y(i.rank===4,()=>`Error in avgPool: x must be rank 4 but got rank ${i.rank}.`),vt("avgPool",s,r);const c={x:i},h={filterSize:t,strides:n,pad:s,dimRoundingMode:r};let p=N.runKernel(Ho,c,h);return p=st(p,a.dtype),u?v(p,[p.shape[1],p.shape[2],p.shape[3]]):p}const wa=b({avgPool_:zp});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Vp(e,t,n,s,r,a="NDHWC"){const o=m(e,"x","avgPool3d","float32");let i=o,u=!1;o.rank===4&&(u=!0,i=v(o,[1,o.shape[0],o.shape[1],o.shape[2],o.shape[3]])),y(i.rank===5,()=>`Error in avgPool3d: x must be rank 5 but got rank ${i.rank}.`),y(a==="NDHWC",()=>`Error in avgPool3d: Only NDHWC is currently supported, but got dataFormat of ${a}`),vt("avgPool3d",s,r);const c={x:i},h={filterSize:t,strides:n,pad:s,dimRoundingMode:r,dataFormat:a};let p=N.runKernel(Go,c,h);return p=st(p,i.dtype),u?v(p,[p.shape[1],p.shape[2],p.shape[3],p.shape[4]]):p}const qp=b({avgPool3d_:Vp});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Up(e,t=0){y(e.length>=1,()=>"Pass at least one tensor to concat");const n=Ae(e,"tensors","concat","string_or_numeric");if(n[0].dtype==="complex64"&&n.forEach(a=>{if(a.dtype!=="complex64")throw new Error(`Cannot concatenate complex64 tensors with a tensor
          with dtype ${a.dtype}. `)}),n.length===1)return Vt(n[0]);const s=n,r={axis:t};return N.runKernel(ni,s,r)}const pt=b({concat_:Up});/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Wp(e){const n={x:m(e,"x","sigmoid","float32")};return N.runKernel(ju,n)}const fe=b({sigmoid_:Wp});/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function jp(e,t,n){const s=m(e,"x","slice","string_or_numeric");if(s.rank===0)throw new Error("Slicing scalar is not possible");const r={x:s},a={begin:t,size:n};return N.runKernel(Vu,r,a)}const K=b({slice_:jp});/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Kp(e){const n={x:m(e,"x","tanh","float32")};return N.runKernel(cc,n)}const ts=b({tanh_:Kp});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Hp(e,t,n,s,r,a){const o=m(e,"forgetBias","basicLSTMCell"),i=m(t,"lstmKernel","basicLSTMCell"),u=m(n,"lstmBias","basicLSTMCell"),c=m(s,"data","basicLSTMCell"),h=m(r,"c","basicLSTMCell"),p=m(a,"h","basicLSTMCell"),f=pt([c,p],1),d=W(f,i),w=rt(d,u),T=w.shape[0],S=w.shape[1]/4,$=[T,S],O=K(w,[0,0],$),I=K(w,[0,S],$),_=K(w,[0,S*2],$),A=K(w,[0,S*3],$),D=rt(z(fe(O),ts(I)),z(h,fe(rt(o,_)))),B=z(ts(D),fe(A));return[D,B]}const Gp=b({basicLSTMCell_:Hp});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Mp(e,t,n){const s=m(e,"x","batchToSpaceND"),r=t.reduce((i,u)=>i*u);y(s.rank>=1+t.length,()=>`input rank is ${s.rank} but should be > than blockShape.length ${t.length}`),y(n.length===t.length,()=>`crops.length is ${n.length} but should be equal to blockShape.length  ${t.length}`),y(s.shape[0]%r===0,()=>`input tensor batch is ${s.shape[0]} but is not divisible by the product of the elements of blockShape ${t.join(" * ")} === ${r}`);const a={x:s},o={blockShape:t,crops:n};return N.runKernel(Xo,a,o)}const Na=b({batchToSpaceND_:Mp});function Xp(e){let t;return e.rank===0||e.rank===1?t=v(e,[1,1,1,e.size]):e.rank===2?t=v(e,[1,1,e.shape[0],e.shape[1]]):e.rank===3?t=v(e,[1,e.shape[0],e.shape[1],e.shape[2]]):t=e,t}/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Yp(e,t,n,s,r,a){a==null&&(a=.001);const o=m(e,"x","batchNorm"),i=m(t,"mean","batchNorm"),u=m(n,"variance","batchNorm");let c;r!=null&&(c=m(r,"scale","batchNorm"));let h;s!=null&&(h=m(s,"offset","batchNorm")),y(i.rank===u.rank,()=>"Batch normalization gradient requires mean and variance to have equal ranks."),y(h==null||i.rank===h.rank,()=>"Batch normalization gradient requires mean and offset to have equal ranks."),y(c==null||i.rank===c.rank,()=>"Batch normalization gradient requires mean and scale to have equal ranks.");const f={x:Xp(o),scale:c,offset:h,mean:i,variance:u},d={varianceEpsilon:a},w=N.runKernel(Fi,f,d);return v(w,o.shape)}const wn=b({batchNorm_:Yp});function Jp(e,t,n,s,r,a){const o=m(e,"x","batchNorm"),i=m(t,"mean","batchNorm"),u=m(n,"variance","batchNorm");let c;r!=null&&(c=m(r,"scale","batchNorm"));let h;return s!=null&&(h=m(s,"offset","batchNorm")),y(o.rank===2,()=>`Error in batchNorm2D: x must be rank 2 but got rank ${o.rank}.`),y(i.rank===2||i.rank===1,()=>`Error in batchNorm2D: mean must be rank 2 or rank 1 but got rank ${i.rank}.`),y(u.rank===2||u.rank===1,()=>`Error in batchNorm2D: variance must be rank 2 or rank 1 but got rank ${u.rank}.`),c!=null&&y(c.rank===2||c.rank===1,()=>`Error in batchNorm2D: scale must be rank 2 or rank 1 but got rank ${c.rank}.`),h!=null&&y(h.rank===2||h.rank===1,()=>`Error in batchNorm2D: offset must be rank 2 or rank 1 but got rank ${h.rank}.`),wn(o,i,u,h,c,a)}const Zp=b({batchNorm2d_:Jp});function Qp(e,t,n,s,r,a){const o=m(e,"x","batchNorm"),i=m(t,"mean","batchNorm"),u=m(n,"variance","batchNorm");let c;r!=null&&(c=m(r,"scale","batchNorm"));let h;return s!=null&&(h=m(s,"offset","batchNorm")),y(o.rank===3,()=>`Error in batchNorm3D: x must be rank 3 but got rank ${o.rank}.`),y(i.rank===3||i.rank===1,()=>`Error in batchNorm3D: mean must be rank 3 or rank 1 but got rank ${i.rank}.`),y(u.rank===3||u.rank===1,()=>`Error in batchNorm3D: variance must be rank 3 or rank 1 but got rank ${u.rank}.`),c!=null&&y(c.rank===3||c.rank===1,()=>`Error in batchNorm3D: scale must be rank 3 or rank 1 but got rank ${c.rank}.`),h!=null&&y(h.rank===3||h.rank===1,()=>`Error in batchNorm3D: offset must be rank 3 or rank 1 but got rank ${h.rank}.`),wn(o,i,u,h,c,a)}const th=b({batchNorm3d_:Qp});function eh(e,t,n,s,r,a){const o=m(e,"x","batchNorm"),i=m(t,"mean","batchNorm"),u=m(n,"variance","batchNorm");let c;r!=null&&(c=m(r,"scale","batchNorm"));let h;return s!=null&&(h=m(s,"offset","batchNorm")),y(o.rank===4,()=>`Error in batchNorm4D: x must be rank 4 but got rank ${o.rank}.`),y(i.rank===4||i.rank===1,()=>`Error in batchNorm4D: mean must be rank 4 or rank 1 but got rank ${i.rank}.`),y(u.rank===4||u.rank===1,()=>`Error in batchNorm4D: variance must be rank 4 or rank 1 but got rank ${u.rank}.`),c!=null&&y(c.rank===4||c.rank===1,()=>`Error in batchNorm4D: scale must be rank 4 or rank 1 but got rank ${c.rank}.`),h!=null&&y(h.rank===4||h.rank===1,()=>`Error in batchNorm4D: offset must be rank 4 or rank 1 but got rank ${h.rank}.`),wn(o,i,u,h,c,a)}const nh=b({batchNorm4d_:eh});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function sh(e,t,n){const s=m(e,"x","bincount"),r=m(t,"weights","bincount");y(s.dtype==="int32",()=>`Error in bincount: input dtype must be int32, but got ${s.dtype}`),y(n>=0,()=>`size must be non-negative, but got ${n}.`),y(r.size===s.size||r.size===0,()=>`Error in bincount: weights must have the same size as input or0-length, but got input shape: ${s.shape}, weights shape: ${r.shape}.`);const a={x:s,weights:r},o={size:n};return N.runKernel(Yo,a,o)}const Ta=b({bincount_:sh});/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function rh(e,t){const n=m(e,"s0","broadcastArgs","int32"),s=m(t,"s1","broadcastArgs","int32");if(n.rank!==1)throw new Error(`broadcastArgs(): first input must be a vector (rank=1). Has rank ${n.rank}`);if(s.rank!==1)throw new Error(`broadcastArgs(): second input must be a vector (rank=1). Has rank ${s.rank}`);const r={s0:n,s1:s};return N.runKernel(Jo,r)}const ah=b({broadcastArgs_:rh});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function oh(e,t){let n=m(e,"broadcastTo","x");const s=n.shape;if(t.some(c=>!(c>0)||c%1!==0))throw new Error(`broadcastTo(): Invalid broadcast shape [${t}].`);if(t.length<n.rank)throw new Error(`broadcastTo(): shape.length=${t.length} < input.rank=${n.rank}.`);if(t.length>n.rank){const c=n.shape.slice();for(;c.length<t.length;)c.unshift(1);n=v(n,c)}const r=n.shape,a=Array.from(t);for(let c=t.length-1;c>=0;c--)if(r[c]===t[c])a[c]=1;else if(n.shape[c]!==1)throw new Error(`broadcastTo(): [${s}] cannot be broadcast to [${t}].`);if(a.map((c,h)=>c>1?h:-1).filter(c=>c>=0).length===0)return Vt(n);const i={x:n},u={reps:a};return N.runKernel(Vr,i,u)}const He=b({broadcastTo_:oh});/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function ih(e){const n={x:m(e,"x","ceil","float32")};return N.runKernel(Zo,n)}const uh=b({ceil_:ih});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Nn(e,t,n){const s={shape:e,value:t,dtype:n};return N.runKernel(Ii,{},s)}/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function ch(e,t,n){const s=m(e,"x","clipByValue");if(y(t<=n,()=>`Error in clip: min (${t}) must be less than or equal to max (${n}).`),t===n)return Nn(s.shape,t,s.dtype);const r={x:s},a={clipValueMin:t,clipValueMax:n};return N.runKernel(Qo,r,a)}const lh=b({clipByValue_:ch});function ph(e){return pt(e,0)}const hh=b({concat1d_:ph});function fh(e,t){return pt(e,t)}const mh=b({concat2d_:fh});function dh(e,t){return pt(e,t)}const gh=b({concat3d_:dh});function yh(e,t){return pt(e,t)}const bh=b({concat4d_:yh});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function wh(e,t,n,s,r="NHWC",a=[1,1],o){const i=m(e,"x","conv2d","float32"),u=m(t,"filter","conv2d","float32");let c=i,h=!1;i.rank===3&&(h=!0,c=v(i,[1,i.shape[0],i.shape[1],i.shape[2]])),y(c.rank===4,()=>`Error in conv2d: input must be rank 4, but got rank ${c.rank}.`),y(u.rank===4,()=>`Error in conv2d: filter must be rank 4, but got rank ${u.rank}.`),vt("conv2d",s,o);const p=r==="NHWC"?c.shape[3]:c.shape[1];y(p===u.shape[2],()=>`Error in conv2d: depth of input (${p}) must match input depth for filter ${u.shape[2]}.`),y(Kt(n,a),()=>`Error in conv2D: Either strides or dilations must be 1. Got strides ${n} and dilations '${a}'`);const f={x:c,filter:u},d={strides:n,pad:s,dataFormat:r,dilations:a,dimRoundingMode:o},w=N.runKernel(si,f,d);return h?v(w,[w.shape[1],w.shape[2],w.shape[3]]):w}const Tn=b({conv2d_:wh});function Nh(e,t,n,s,r="NWC",a=1,o){const i=m(e,"x","conv1d"),u=m(t,"filter","conv1d");let c=i,h=!1;i.rank===2&&(h=!0,c=v(i,[1,i.shape[0],i.shape[1]])),y(c.rank===3,()=>`Error in conv1d: input must be rank 3, but got rank ${c.rank}.`),y(u.rank===3,()=>`Error in conv1d: filter must be rank 3, but got rank ${u.rank}.`),vt("conv1d",s,o),y(c.shape[2]===u.shape[1],()=>`Error in conv1d: depth of input (${c.shape[2]}) must match input depth for filter ${u.shape[1]}.`),y(Kt(n,a),()=>`Error in conv1D: Either stride or dilation must be 1. Got stride ${n} and dilation '${a}'`),y(r==="NWC",()=>`Error in conv1d: got dataFormat of ${r} but only NWC is currently supported.`);const p=v(u,[1,u.shape[0],u.shape[1],u.shape[2]]),f=v(c,[c.shape[0],1,c.shape[1],c.shape[2]]),S=Tn(f,p,[1,n],s,"NHWC",[1,a],o);return h?v(S,[S.shape[2],S.shape[3]]):v(S,[S.shape[0],S.shape[2],S.shape[3]])}const Th=b({conv1d_:Nh});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Sh(e,t,n,s,r,a="NHWC",o){y(e.length===t.rank,()=>`Length of inShape (${e.length}) and rank of dy (${t.rank}) must match`);let i=e,u=t,c=!1;t.rank===3&&(c=!0,u=v(t,[1,t.shape[0],t.shape[1],t.shape[2]]),i=[1,e[0],e[1],e[2]]),y(i.length===4,()=>`Error in conv2dDerInput: inShape must be length 4, but got length ${i.length}.`),y(u.rank===4,()=>`Error in conv2dDerInput: dy must be rank 4, but got rank ${u.rank}`),y(n.rank===4,()=>`Error in conv2dDerInput: filter must be rank 4, but got rank ${n.rank}`);const h=a==="NHWC"?i[3]:i[1],p=a==="NHWC"?u.shape[3]:u.shape[1];y(h===n.shape[2],()=>`Error in conv2dDerInput: depth of input (${h}) must match input depth for filter ${n.shape[2]}.`),y(p===n.shape[3],()=>`Error in conv2dDerInput: depth of output (${p}) must match output depth for filter ${n.shape[3]}.`),vt("conv2dDerInput",r,o);const f={dy:u,filter:n},d={strides:s,pad:r,dataFormat:a,dimRoundingMode:o,inputShape:i},w=N.runKernel(ai,f,d);return c?v(w,[w.shape[1],w.shape[2],w.shape[3]]):w}const Sa=b({conv2DBackpropInput_:Sh});function $h(e,t,n,s,r,a){const o=m(e,"x","conv2dTranspose"),i=m(t,"filter","conv2dTranspose");return Sa(n,o,i,s,r,"NHWC",a)}const kh=b({conv2dTranspose_:$h});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Eh(e,t,n,s,r="NDHWC",a=[1,1,1]){const o=m(e,"x","conv3d"),i=m(t,"filter","conv3d");let u=o,c=!1;o.rank===4&&(c=!0,u=v(o,[1,o.shape[0],o.shape[1],o.shape[2],o.shape[3]])),y(u.rank===5,()=>`Error in conv3d: input must be rank 5, but got rank ${u.rank}.`),y(i.rank===5,()=>`Error in conv3d: filter must be rank 5, but got rank ${i.rank}.`),y(u.shape[4]===i.shape[3],()=>`Error in conv3d: depth of input (${u.shape[4]}) must match input depth for filter ${i.shape[3]}.`),y(Kt(n,a),()=>`Error in conv3D: Either strides or dilations must be 1. Got strides ${n} and dilations '${a}'`),y(r==="NDHWC",()=>`Error in conv3d: got dataFormat of ${r} but only NDHWC is currently supported.`);const h={x:u,filter:i},p={strides:n,pad:s,dataFormat:r,dilations:a},f=N.runKernel(oi,h,p);return c?v(f,[f.shape[1],f.shape[2],f.shape[3],f.shape[4]]):f}const vh=b({conv3d_:Eh});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function _h(e,t,n,s,r){y(e.length===t.rank,()=>`Length of inShape (${e.length}) and rank of dy (${t.rank}) must match`);let a=e,o=t,i=!1;t.rank===4&&(i=!0,o=v(t,[1,t.shape[0],t.shape[1],t.shape[2],t.shape[3]]),a=[1,e[0],e[1],e[2],e[3]]);const u=a[4],c=o.shape[4];y(a.length===5,()=>`Error in conv3dDerInput: inShape must be length 5, but got length ${a.length}.`),y(o.rank===5,()=>`Error in conv3dDerInput: dy must be rank 5, but got rank ${o.rank}`),y(n.rank===5,()=>`Error in conv3dDerInput: filter must be rank 5, but got rank ${n.rank}`),y(u===n.shape[3],()=>`Error in conv3dDerInput: depth of input (${u}) must match input depth for filter ${n.shape[3]}.`),y(c===n.shape[4],()=>`Error in conv3dDerInput: depth of output (${c}) must match output depth for filter ${n.shape[4]}.`);const h={dy:o,filter:n},p={pad:r,strides:s,inputShape:a},f=N.runKernel(ii,h,p);return i?v(f,[f.shape[1],f.shape[2],f.shape[3],f.shape[4]]):f}const xh=b({conv3DBackpropInput_:_h});function Ih(e,t,n,s,r){const a=m(e,"x","conv3dTranspose"),o=m(t,"filter","conv3dTranspose");return xh(n,a,o,s,r)}const Ah=b({conv3dTranspose_:Ih});/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Dh(e){const n={x:m(e,"x","cos","float32")};return N.runKernel(ui,n)}const Oh=b({cos_:Dh});/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Fh(e){const n={x:m(e,"x","cosh","float32")};return N.runKernel(ci,n)}const Ch=b({cosh_:Fh});/**
 * @license
 * Copyright 2022 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Bh(e,t=0,n=!1,s=!1){const a={x:m(e,"x","cumprod")},o={axis:t,exclusive:n,reverse:s};return N.runKernel(li,a,o)}const Lh=b({cumprod_:Bh});/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Ph(e,t=0,n=!1,s=!1){const a={x:m(e,"x","cumsum")},o={axis:t,exclusive:n,reverse:s};return N.runKernel(pi,a,o)}const Rh=b({cumsum_:Ph});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function zh(e,t,n,s=!1){const r=m(e,"x","denseBincount"),a=m(t,"weights","denseBincount");y(r.dtype==="int32",()=>`Error in denseBincount: input dtype must be int32, but got ${r.dtype}`),y(r.rank<=2,()=>`Error in denseBincount: input must be at most rank 2, but got rank ${r.rank}.`),y(n>=0,()=>`size must be non-negative, but got ${n}.`),y(a.size===r.size||a.size===0,()=>`Error in denseBincount: weights must have the same shape as x or 0-length, but got x shape: ${r.shape}, weights shape: ${a.shape}.`);const o={x:r,weights:a},i={size:n,binaryOutput:s};return N.runKernel(fi,o,i)}const Vh=b({denseBincount_:zh});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function qh(e,t,n="NHWC"){const s=m(e,"x","depthToSpace","float32"),r=n==="NHWC"?s.shape[1]:s.shape[2],a=n==="NHWC"?s.shape[2]:s.shape[3],o=n==="NHWC"?s.shape[3]:s.shape[1];y(t>1,()=>`blockSize should be > 1 for depthToSpace, but was: ${t}`),y(r*t>=0,()=>`Negative dimension size caused by overflow when multiplying
    ${r} and ${t}  for depthToSpace with input shape
    ${s.shape}`),y(a*t>=0,()=>`Negative dimension size caused by overflow when multiplying
    ${a} and ${t} for depthToSpace with input shape
        ${s.shape}`),y(o%(t*t)===0,()=>`Dimension size must be evenly divisible by ${t*t} but is ${o} for depthToSpace with input shape ${s.shape}`);const i={x:s},u={blockSize:t,dataFormat:n};return N.runKernel(mi,i,u)}const Uh=b({depthToSpace_:qh});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Wh(e,t,n,s,r="NHWC",a=[1,1],o){const i=m(e,"x","depthwiseConv2d","float32"),u=m(t,"filter","depthwiseConv2d","float32");let c=i,h=!1;i.rank===3&&(h=!0,c=v(i,[1,i.shape[0],i.shape[1],i.shape[2]])),y(c.rank===4,()=>`Error in depthwiseConv2d: input must be rank 4, but got rank ${c.rank}.`),y(u.rank===4,()=>`Error in depthwiseConv2d: filter must be rank 4, but got rank ${u.rank}.`);const p=r==="NHWC"?c.shape[3]:c.shape[1];y(p===u.shape[2],()=>`Error in depthwiseConv2d: number of input channels (${p}) must match the inChannels dimension in filter ${u.shape[2]}.`),vt("depthwiseConv2d",s,o);const f={x:c,filter:u},d={strides:n,pad:s,dataFormat:r,dilations:a,dimRoundingMode:o},w=N.runKernel(di,f,d);return h?v(w,[w.shape[1],w.shape[2],w.shape[3]]):w}const _s=b({depthwiseConv2d_:Wh});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function jh(e){const n={x:m(e,"x","diag")};return N.runKernel(bi,n)}const Kh=b({diag_:jh});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Hh(e,t,n,s,r=[1,1],a="NHWC"){const o=m(e,"x","dilation2d"),i=m(t,"filter","dilation2d");y(o.rank===3||o.rank===4,()=>`Error in dilation2d: input must be rank 3 or 4, but got rank ${o.rank}.`),y(i.rank===3,()=>`Error in dilation2d: filter must be rank 3, but got rank ${i.rank}.`),y(a==="NHWC",()=>`Error in dilation2d: Only NHWC is currently supported, but got dataFormat of ${a}`);let u=o,c=!1;o.rank===3&&(u=v(o,[1,o.shape[0],o.shape[1],o.shape[2]]),c=!0);const h={x:u,filter:i},p={strides:n,pad:s,dilations:r},f=N.runKernel(wi,h,p);return c?v(f,[f.shape[1],f.shape[2],f.shape[3]]):f}const Gh=b({dilation2d_:Hh});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Mh(e,t){let n=m(e,"a","equal","string_or_numeric"),s=m(t,"b","equal","string_or_numeric");[n,s]=X(n,s),tt(n.shape,s.shape);const r={a:n,b:s};return N.runKernel(ki,r)}const $a=b({equal_:Mh});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Xh(e,t,n){const s=m(t,"a","where"),r=m(n,"b","where"),a=m(e,"condition","where","bool"),o=tt(tt(a.shape,s.shape),r.shape),i=He(a,o),u=He(s,o),c=He(r,o),h={condition:i,t:u,e:c};return N.runKernel(Ru,h)}const be=b({where_:Xh});/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Yh(e){const n={x:m(e,"x","zerosLike")};return N.runKernel(dc,n)}const xs=b({zerosLike_:Yh});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Jh(e,t){let n=m(e,"a","div"),s=m(t,"b","div");[n,s]=X(n,s);const r=lt(n,s),a=xs(r),o=$a(s,a);return be(o,a,r)}const Zh=b({divNoNan_:Jh});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Qh(e,t){const n=m(e,"t1","dot"),s=m(t,"t2","dot");y((n.rank===1||n.rank===2)&&(s.rank===1||s.rank===2),()=>`Error in dot: inputs must all be rank 1 or 2, but got ranks ${n.rank} and ${s.rank}.`);const r=n.rank===1?n.size:n.shape[1],a=s.rank===1?s.size:s.shape[0];if(y(r===a,()=>`Error in dot: inner dimensions of inputs must match, but got ${r} and ${a}.`),n.rank===1&&s.rank===1){const o=v(n,[1,-1]),i=v(s,[-1,1]),u=W(o,i);return v(u,[])}else if(n.rank===1&&s.rank===2){const o=v(n,[1,-1]),i=v(s,[s.shape[0],s.shape[1]]),u=W(o,i);return v(u,[u.size])}else if(n.rank===2&&s.rank===1){const o=v(s,[-1,1]),i=W(n,o);return v(i,[i.size])}else{const o=v(s,[s.shape[0],s.shape[1]]);return W(n,o)}}const tf=b({dot_:Qh});/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function ef(e,...t){const n=t.map((r,a)=>m(r,`tensors${a}`,"einsum")),s={equation:e};return N.runKernel(Ti,n,s)}const nf=b({einsum_:ef});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function sf(e){const n={x:m(e,"x","elu","float32")};return N.runKernel(Si,n)}const ka=b({elu_:sf});/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function rf(e){let t=m(e,"x","erf");y(t.dtype==="int32"||t.dtype==="float32",()=>"Input dtype must be `int32` or `float32`."),t.dtype==="int32"&&(t=st(t,"float32"));const n={x:t};return N.runKernel($i,n)}const af=b({erf_:rf});/**
 * @license
 * Copyright 2017 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Ea(e,t){for(let n=0;n<e.length;++n)if(e[e.length-n-1]!==t-1-n)return!1;return!0}function of(e,t,n){const s=e.length+t.length,r=[];let a=0,o=0;for(let i=0;i<s;i++)n.indexOf(i)===-1?r.push(e[a++]):r.push(t[o++]);return r}function p1(e,t){const n=[],s=e.length;for(let a=0;a<s;a++)t.indexOf(a)===-1&&n.push(e[a]);const r=t.map(a=>e[a]);return[n,r]}function Sn(e,t){const n=t.map(s=>1);return of(e,n,t)}function h1(e,t,n){y(Ea(t,n),()=>`${e} supports only inner-most axes for now. Got axes ${t} and rank-${n} input.`)}function f1(e,t){if(Ea(e,t))return null;const n=[];for(let s=0;s<t;++s)e.indexOf(s)===-1&&n.push(s);return e.forEach(s=>n.push(s)),n}function m1(e){return e.map((t,n)=>[n,t]).sort((t,n)=>t[1]-n[1]).map(t=>t[0])}function d1(e,t){const n=[];for(let s=t-e;s<t;++s)n.push(s);return n}/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function uf(e,t=null,n=!1){const r={x:m(e,"x","max")},a={reductionIndices:t,keepDims:n};return N.runKernel(Qi,r,a)}const me=b({max_:uf});/**
 * @license
 * Copyright 2020 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function cf(e,t=null,n=!1){const r={x:m(e,"x","min")},a={axis:t,keepDims:n};return N.runKernel(au,r,a)}const es=b({min_:cf});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function lf(e,t){let n=m(e,"base","pow"),s=m(t,"exp","pow");[n,s]=X(n,s);const r={a:n,b:s};return N.runKernel(Nu,r)}const Is=b({pow_:lf});/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function U(e,t){if((Et(e)&&t!=="string"||Array.isArray(e))&&t!=="complex64")throw new Error("Error creating a new Scalar: value must be a primitive (number|boolean|string)");if(t==="string"&&Et(e)&&!(e instanceof Uint8Array))throw new Error("When making a scalar from encoded string, the value must be `Uint8Array`.");return jt(e,[],[],t)}/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function pf(e){const n={x:m(e,"x","sqrt","float32")};return N.runKernel(Hu,n)}const ns=b({sqrt_:pf});/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function hf(e){const t=m(e,"x","square"),n={};return N.runKernel("Square",{x:t},n)}const $n=b({square_:hf});/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function ff(e,t=null,n=!1){let s=m(e,"x","sum");s.dtype==="bool"&&(s=st(s,"int32"));const r={x:s},a={axis:t,keepDims:n};return N.runKernel(Gu,r,a)}const H=b({sum_:ff});/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function mf(e,t="euclidean",n=null,s=!1){e=m(e,"x","norm");const r=va(e,t,n);let a=r.shape;if(s){const o=Le(n,e.shape);a=Sn(r.shape,o)}return v(r,a)}function va(e,t,n=null){if(e.rank===0)return Nt(e);if(e.rank!==1&&n===null)return va(v(e,[-1]),t,n);if(e.rank===1||typeof n=="number"||Array.isArray(n)&&n.length===1){if(t===1)return H(Nt(e),n);if(t===1/0)return me(Nt(e),n);if(t===-1/0)return es(Nt(e),n);if(t==="euclidean"||t===2)return ns(H(Is(Nt(e),U(2,"int32")),n));throw new Error(`Error in norm: invalid ord value: ${t}`)}if(Array.isArray(n)&&n.length===2){if(t===1)return me(H(Nt(e),n[0]),n[1]-1);if(t===1/0)return me(H(Nt(e),n[1]),n[0]);if(t===-1/0)return es(H(Nt(e),n[1]),n[0]);if(t==="fro"||t==="euclidean")return ns(H($n(e),n));throw new Error(`Error in norm: invalid ord value: ${t}`)}throw new Error(`Error in norm: invalid axis: ${n}`)}const kn=b({norm_:mf});/**
 * @license
 * Copyright 2022 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function df(e,t=null,n=!1){return kn(e,"euclidean",t,n)}const gf=b({euclideanNorm_:df});/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function yf(e){const n={x:m(e,"x","exp")};return N.runKernel(Ei,n)}const re=b({exp_:yf});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function bf(e,t=0){const n=m(e,"x","expandDims","string_or_numeric");y(t<=n.rank,()=>"Axis must be <= rank of the tensor");const s={input:n},r={dim:t};return N.runKernel(vi,s,r)}const Gt=b({expandDims_:bf});/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function wf(e){const n={x:m(e,"x","expm1")};return N.runKernel(_i,n)}const Nf=b({expm1_:wf});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Tf(e,t){const n=m(e,"x","tile","string_or_numeric");y(n.rank===t.length,()=>`Error in transpose: rank of input ${n.rank} must match length of reps ${t}.`);const s={x:n},r={reps:t};return N.runKernel(Vr,s,r)}const ve=b({tile_:Tf});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Sf(e,t,n,s="float32"){t==null&&(t=e);const r=Ft([e,t],s),a=e<=t?e:t;for(let i=0;i<a;++i)r.set(1,i,i);const o=v(r.toTensor(),[e,t]);if(n==null)return o;if(n.length===1)return ve(Gt(o,0),[n[0],1,1]);if(n.length===2)return ve(Gt(Gt(o,0),0),[n[0],n[1],1,1]);if(n.length===3)return ve(Gt(Gt(Gt(o,0),0),0),[n[0],n[1],n[2],1,1]);throw new Error(`eye() currently supports only 1D and 2D batchShapes, but received ${n.length}D.`)}const _a=b({eye_:Sf});/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function $f(e){const n={x:m(e,"x","floor","float32")};return N.runKernel(Di,n)}const xa=b({floor_:$f});/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function kf(e,t,n=0,s=0){const r=m(e,"x","gather"),a=m(t,"indices","gather","int32"),o={x:r,indices:a},i={axis:n,batchDims:s};return N.runKernel(Ci,o,i)}const Ia=b({gather_:kf});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Ef(e,t){let n=m(e,"a","greater","string_or_numeric"),s=m(t,"b","greater","string_or_numeric");[n,s]=X(n,s),tt(n.shape,s.shape);const r={a:n,b:s};return N.runKernel(Li,r)}const En=b({greater_:Ef});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function vf(e,t){let n=m(e,"a","greaterEqual","string_or_numeric"),s=m(t,"b","greaterEqual","string_or_numeric");[n,s]=X(n,s),tt(n.shape,s.shape);const r={a:n,b:s};return N.runKernel(Pi,r)}const Aa=b({greaterEqual_:vf});/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function _f(e){const n={x:m(e,"x","isFinite")};return N.runKernel(Vi,n)}const xf=b({isFinite_:_f});/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function If(e){const n={x:m(e,"x","isInf")};return N.runKernel(qi,n)}const Af=b({isInf_:If});/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Df(e){const n={x:m(e,"x","isNaN")};return N.runKernel(Ui,n)}const Of=b({isNaN_:Df});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Ff(e,t=.2){const s={x:m(e,"x","leakyRelu")},r={alpha:t};return N.runKernel(Wi,s,r)}const Da=b({leakyRelu_:Ff});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Cf(e,t){let n=m(e,"a","less","string_or_numeric"),s=m(t,"b","less","string_or_numeric");[n,s]=X(n,s),tt(n.shape,s.shape);const r={a:n,b:s};return N.runKernel(ji,r)}const Bf=b({less_:Cf});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Lf(e,t){let n=m(e,"a","lessEqual","string_or_numeric"),s=m(t,"b","lessEqual","string_or_numeric");[n,s]=X(n,s),tt(n.shape,s.shape);const r={a:n,b:s};return N.runKernel(Ki,r)}const As=b({lessEqual_:Lf});/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Pf(e,t,n){if(n<=0)throw new Error("The number of values should be positive.");const s={start:e,stop:t,num:n};return N.runKernel(Hi,{},s)}/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Rf(e,t=5,n=1,s=1,r=.5){const a=m(e,"x","localResponseNormalization");y(a.rank===4||a.rank===3,()=>`Error in localResponseNormalization: x must be rank 3 or 4 but got
               rank ${a.rank}.`),y(de(t),()=>`Error in localResponseNormalization: depthRadius must be an integer but got depthRadius ${t}.`);let o=a,i=!1;a.rank===3&&(i=!0,o=v(a,[1,a.shape[0],a.shape[1],a.shape[2]]));const u={x:o},c={depthRadius:t,bias:n,alpha:s,beta:r},h=N.runKernel(Zi,u,c);return i?v(h,[h.shape[1],h.shape[2],h.shape[3]]):h}const zf=b({localResponseNormalization_:Rf});/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Vf(e){const n={x:m(e,"x","log","float32")};return N.runKernel(Gi,n)}const Oe=b({log_:Vf});/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function qf(e){const n={x:m(e,"x","log1p")};return N.runKernel(Mi,n)}const Oa=b({log1p_:qf});/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function g1(e){return y(qt(e),()=>"The f passed in grad(f) must be a function"),(t,n)=>{const s=m(t,"x","tf.grad","string_or_numeric"),r=n!=null?m(n,"dy","tf.grad"):null;return N.tidy(()=>{const{value:a,grads:o}=N.gradients(()=>e(s),[s],r);return r!=null&&ht(a.shape,r.shape,"The shape of dy passed in grad(f)(x, dy) must match the shape returned by f(x)"),vn(o),o[0]})}}function y1(e){return y(qt(e),()=>"The f passed in grads(f) must be a function"),(t,n)=>{y(Array.isArray(t),()=>"The args passed in grads(f)(args) must be an array of `Tensor`s or `TensorLike`s");const s=Ae(t,"args","tf.grads","string_or_numeric"),r=n!=null?m(n,"dy","tf.grads"):null;return N.tidy(()=>{const{value:a,grads:o}=N.gradients(()=>e(...s),s,r);return r!=null&&ht(a.shape,r.shape,"The shape of dy passed in grads(f)([x1,...], dy) must match the shape returned by f([x1,...])"),vn(o),o})}}function b1(e){return y(qt(e),()=>"The f passed in valueAndGrad(f) must be a function"),(t,n)=>{y(t instanceof Z,()=>"The x passed in valueAndGrad(f)(x) must be a tensor"),y(n==null||n instanceof Z,()=>"The dy passed in valueAndGrad(f)(x, dy) must be a tensor");const{grads:s,value:r}=N.gradients(()=>e(t),[t],n);return vn(s),{grad:s[0],value:r}}}function w1(e){return y(qt(e),()=>"The f passed in valueAndGrads(f) must be a function"),(t,n)=>{y(Array.isArray(t)&&t.every(r=>r instanceof Z),()=>"The args passed in valueAndGrads(f)(args) must be array of tensors"),y(n==null||n instanceof Z,()=>"The dy passed in valueAndGrads(f)(args, dy) must be a tensor");const s=N.gradients(()=>e(...t),t,n);return n!=null&&ht(s.value.shape,n.shape,"The shape of dy passed in valueAndGrads(f)([x1,...], dy) must match the shape returned by f([x1,...])"),vn(s.grads),s}}function N1(e,t){y(qt(e),()=>"The f passed in variableGrads(f) must be a function"),y(t==null||Array.isArray(t)&&t.every(c=>c instanceof nn),()=>"The varList passed in variableGrads(f, varList) must be an array of variables");const n=t!=null;if(!n){t=[];for(const c in N.registeredVariables)t.push(N.registeredVariables[c])}const s=n?t.filter(c=>!c.trainable):null,r=t.length;t=t.filter(c=>c.trainable),y(t.length>0,()=>`variableGrads() expects at least one of the input variables to be trainable, but none of the ${r} variables is trainable.`);const a=!0,{value:o,grads:i}=N.gradients(e,t,null,a);y(i.some(c=>c!=null),()=>"Cannot find a connection between any variable and the result of the loss function y=f(x). Please make sure the operations that use variables are inside the function f passed to minimize()."),y(o.rank===0,()=>`The f passed in variableGrads(f) must return a scalar, but it returned a rank-${o.rank} tensor`);const u={};return t.forEach((c,h)=>{i[h]!=null&&(u[c.name]=i[h])}),s!=null&&s.forEach(c=>u[c.name]=null),{value:o,grads:u}}function Ct(e){return N.customGrad(e)}function vn(e){if(e.filter(n=>n==null).length>0)throw new Error(`Cannot compute gradient of y=f(x) with respect to x. Make sure that
    the f you passed encloses all operations that lead from x to y.`)}/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Uf(e){const n={x:m(e,"x","softplus")};return N.runKernel(Ku,n)}const Fa=b({softplus_:Uf});/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Wf(e){const t=m(e,"x","logSigmoid");return Ct(s=>({value:Dt(Fa(Dt(s))),gradFunc:o=>z(o,fe(Dt(s)))}))(t)}const jf=b({logSigmoid_:Wf});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Kf(e,t){let n=m(e,"a","sub"),s=m(t,"b","sub");[n,s]=X(n,s);const r={a:n,b:s};return N.runKernel(ic,r)}const V=b({sub_:Kf});/**
 * @license
 * Copyright 2020 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Hf(e,t=-1){const n=m(e,"logits","logSoftmax");if(t===-1&&(t=n.rank-1),t!==n.rank-1)throw Error(`Log Softmax along a non-last dimension is not yet supported. Logits was rank ${n.rank} and axis was ${t}`);return Ct((r,a)=>{const i=me(r,t,!0),u=V(r,i),c=V(st(u,"float32"),Oe(H(re(u),t,!0)));return a([c]),{value:c,gradFunc:(p,f)=>{const[d]=f,w=!0,T=re(d);return V(p,z(H(p,t,w),T))}}})(n)}const Gf=b({logSoftmax_:Hf});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Mf(e,t=null,n=!1){const s=m(e,"x","logSumExp"),r=Le(t,s.shape),a=me(s,r,!0),o=V(s,a),i=re(o),u=H(i,r),c=Oe(u),h=rt(v(a,c.shape),c);if(n){const p=Sn(h.shape,r);return v(h,p)}return h}const Ca=b({logSumExp_:Mf});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Xf(e,t){const n=m(e,"a","logicalAnd","bool"),s=m(t,"b","logicalAnd","bool");tt(n.shape,s.shape);const r={a:n,b:s};return N.runKernel(Xi,r)}const un=b({logicalAnd_:Xf});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Yf(e){const n={x:m(e,"x","logicalNot","bool")};return N.runKernel(Yi,n)}const Ba=b({logicalNot_:Yf});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Jf(e,t){const n=m(e,"a","logicalOr","bool"),s=m(t,"b","logicalOr","bool");tt(n.shape,s.shape);const r={a:n,b:s};return N.runKernel(Ji,r)}const La=b({logicalOr_:Jf});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Zf(e,t){const n=m(e,"a","logicalXor","bool"),s=m(t,"b","logicalXor","bool");return tt(n.shape,s.shape),un(La(e,t),Ba(un(e,t)))}const Qf=b({logicalXor_:Zf});/**
 * @license
 * Copyright 2022 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */const We=2147483648;function tm(e,t,n="left"){const s=m(e,"sortedSequence","searchSorted"),r=m(t,"values","searchSorted"),a=s.shape[s.shape.length-1],o=r.shape[r.shape.length-1],i=v(s,[-1,a]),u=v(r,[-1,o]);if(i.rank<2)throw new Error("Sorted input argument must be at least 2-dimensional");if(i.shape[0]!==u.shape[0])throw new Error("Leading dimension of 'sortedSequence' and 'values' must match.");if(Q(u.shape)>=We)throw new Error(`values tensor size must less than ${We}`);if(i.shape[1]>=We)throw new Error(`trailing dim_size must less than ${We} for int32 output type, was ${i.shape[1]}`);const c={sortedSequence:i,values:u},h={side:n};return N.runKernel(Pu,c,h)}const Ds=b({searchSorted_:tm});/**
 * @license
 * Copyright 2022 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function em(e,t){return Ds(e,t,"left")}/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function nm(e,t,n,s,r){const a=m(e,"x","maxPool"),o=1;let i=a,u=!1;a.rank===3&&(u=!0,i=v(a,[1,a.shape[0],a.shape[1],a.shape[2]])),y(i.rank===4,()=>`Error in maxPool: input must be rank 4 but got rank ${i.rank}.`),y(Kt(n,o),()=>`Error in maxPool: Either strides or dilations must be 1. Got strides ${n} and dilations '${o}'`),vt("maxPool",s,r);const c={x:i},h={filterSize:t,strides:n,pad:s,dimRoundingMode:r},p=N.runKernel(eu,c,h);return u?v(p,[p.shape[1],p.shape[2],p.shape[3]]):p}const Pa=b({maxPool_:nm});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function sm(e,t=[1,1,1],n,s,r,a="NDHWC"){const o=m(e,"x","maxPool3d");let i=o,u=!1;o.rank===4&&(u=!0,i=v(o,[1,o.shape[0],o.shape[1],o.shape[2],o.shape[3]])),y(i.rank===5,()=>`Error in maxPool3d: x must be rank 5 but got rank ${i.rank}.`),y(a==="NDHWC",()=>`Error in maxPool3d: Only NDHWC is currently supported, but got dataFormat of ${a}`),vt("maxPool3d",s,r);const c={x:i},h={filterSize:t,strides:n,pad:s,dimRoundingMode:r,dataFormat:a},p=N.runKernel(nu,c,h);return u?v(p,[p.shape[1],p.shape[2],p.shape[3],p.shape[4]]):p}const rm=b({maxPool3d_:sm});/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function am(e,t,n,s,r=!1){const o={x:m(e,"x","maxPoolWithArgmax")},i={filterSize:t,strides:n,pad:s,includeBatchInIndex:r},u=N.runKernel(su,o,i);return{result:u[0],indexes:u[1]}}const om=b({maxPoolWithArgmax_:am});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function im(e,t){let n=m(e,"a","maximum"),s=m(t,"b","maximum");[n,s]=X(n,s),n.dtype==="bool"&&(n=st(n,"int32"),s=st(s,"int32")),tt(n.shape,s.shape);const r={a:n,b:s};return N.runKernel(tu,r)}const um=b({maximum_:im});/**
 * @license
 * Copyright 2020 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function cm(e,t=null,n=!1){const r={x:m(e,"x","mean")},a={axis:t,keepDims:n};return N.runKernel(ru,r,a)}const cn=b({mean_:cm});/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function we(e,t="float32"){if(t==="complex64"){const s=we(e,"float32"),r=we(e,"float32");return Ut(s,r)}const n=dn(Q(e),t);return N.makeTensor(n,e,t)}/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Jt(e,t="float32"){if(t==="complex64"){const s=Jt(e,"float32"),r=we(e,"float32");return Ut(s,r)}const n=ms(Q(e),t);return N.makeTensor(n,e,t)}/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function lm(e,t,{indexing:n="xy"}={}){if(n!=="xy"&&n!=="ij")throw new TypeError(`${n} is not a valid third argument to meshgrid`);if(e===void 0)return[];let s=m(e,"x","meshgrid",e instanceof Z?e.dtype:"float32");if(t===void 0)return[s];let r=m(t,"y","meshgrid",t instanceof Z?t.dtype:"float32");const a=Q(s.shape),o=Q(r.shape);return n==="xy"?(s=v(s,[1,-1]),r=v(r,[-1,1]),[W(Jt([o,1],s.dtype),s),W(r,Jt([1,a],r.dtype))]):(s=v(s,[-1,1]),r=v(r,[1,-1]),[W(s,Jt([1,o],s.dtype)),W(Jt([a,1],r.dtype),r)])}/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function pm(e,t){let n=m(e,"a","minimum"),s=m(t,"b","minimum");[n,s]=X(n,s),n.dtype==="bool"&&(n=st(n,"int32"),s=st(s,"int32")),tt(n.shape,s.shape);const r={a:n,b:s};return N.runKernel(ou,r)}const Ra=b({minimum_:pm});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function hm(e,t,n){y(n==="reflect"||n==="symmetric",()=>`Invalid mode. Mode must be either reflect or symmetric. Got ${n}.`);const s=m(e,"x","mirrorPad");if(s.rank===0)throw new Error("mirrorPad(scalar) is not defined. Pass non-scalar to mirrorPad");y(t.length===s.rank,()=>`Padding doesn't match input. Must be ${s.rank}. Got ${t.length}.`);const r=n==="reflect"?1:0;for(let i=0;i<s.rank;i++)y(t[i].length===2,()=>"Invalid number of paddings. Must be length of 2 each."),y(t[i][0]>=0&&t[i][0]<=s.shape[i]-r&&t[i][1]>=0&&t[i][1]<=s.shape[i]-r,()=>`Padding in dimension ${i} cannot be greater than or equal to ${s.shape[i]-r} or less than 0 for input of shape ${s.shape}`);const a={paddings:t,mode:n},o={x:s};return N.runKernel(iu,o,a)}const fm=b({mirrorPad_:hm});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function mm(e,t){let n=m(e,"a","mod"),s=m(t,"b","mod");[n,s]=X(n,s);const r={a:n,b:s};return N.runKernel(uu,r)}const dm=b({mod_:mm});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function gm(e,t=null,n=!1){e=m(e,"x","moments");const s=Le(t,e.shape),r=cn(e,s,n);let a=r.shape;n||(a=Sn(r.shape,s));const o=$n(V(st(e,"float32"),v(r,a))),i=cn(o,s,n);return{mean:r,variance:i}}const ym=b({moments_:gm});function bm(e,t,n,s){const r=m(t,"data","multiRNNCell"),a=Ae(n,"c","multiRNNCell"),o=Ae(s,"h","multiRNNCell");let i=r;const u=[];for(let p=0;p<e.length;p++){const f=e[p](i,a[p],o[p]);u.push(f[0]),u.push(f[1]),i=f[1]}const c=[],h=[];for(let p=0;p<u.length;p+=2)c.push(u[p]),h.push(u[p+1]);return[c,h]}const wm=b({multiRNNCell_:bm});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Nm(e,t,n,s=!1){const r=m(e,"logits","multinomial"),a=r.size,o=r.rank;if(a<2)throw new Error(`Error in multinomial: you need at least 2 outcomes, but got ${a}.`);if(o>2)throw new Error(`Rank of probabilities must be 1 or 2, but is ${o}`);n=n||Math.random();const u={logits:o===1?v(r,[1,-1]):r},c={numSamples:t,seed:n,normalized:s},h=N.runKernel(cu,u,c);return o===1?v(h,[h.size]):h}const Tm=b({multinomial_:Nm});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Sm(e,t){let n=m(e,"a","notEqual","string_or_numeric"),s=m(t,"b","notEqual","string_or_numeric");[n,s]=X(n,s),tt(n.shape,s.shape);const r={a:n,b:s};return N.runKernel(hu,r)}const za=b({notEqual_:Sm});/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function $m(e){const n={x:m(e,"x","onesLike")};return N.runKernel(gu,n)}const km=b({onesLike_:$m});function Em(e,t){const n=m(e,"v1","outerProduct"),s=m(t,"v2","outerProduct");y(n.rank===1&&s.rank===1,()=>`Error in outerProduct: inputs must be rank 1, but got ranks ${n.rank} and ${s.rank}.`);const r=v(n,[-1,1]),a=v(s,[1,-1]);return W(r,a)}const vm=b({outerProduct_:Em});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function _m(e,t,n=0){const s=m(e,"x","pad");if(s.rank===0)throw new Error("pad(scalar) is not defined. Pass non-scalar to pad");const r={paddings:t,constantValue:n},a={x:s};return N.runKernel(wu,a,r)}const Ve=b({pad_:_m});function xm(e,t,n=0){return y(t.length===2,()=>"Invalid number of paddings. Must be length of 2."),Ve(e,[t],n)}const Im=b({pad1d_:xm});function Am(e,t,n=0){return y(t.length===2&&t[0].length===2&&t[1].length===2,()=>"Invalid number of paddings. Must be length of 2 each."),Ve(e,t,n)}const Dm=b({pad2d_:Am});function Om(e,t,n=0){return y(t.length===3&&t[0].length===2&&t[1].length===2&&t[2].length===2,()=>"Invalid number of paddings. Must be length of 2 each."),Ve(e,t,n)}const Fm=b({pad3d_:Om});function Cm(e,t,n=0){return y(t.length===4&&t[0].length===2&&t[1].length===2&&t[2].length===2&&t[3].length===2,()=>"Invalid number of paddings. Must be length of 2 each."),Ve(e,t,n)}const Bm=b({pad4d_:Cm});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Lm(e,t,n){const s=m(e,"x","spaceToBatchND");y(s.rank>=1+t.length,()=>`input rank ${s.rank} should be > than [blockShape] ${t.length}`),y(n.length===t.length,()=>`paddings.shape[0] ${n.length} must be equal to [blockShape] ${t.length}`),y(s.shape.reduce((o,i,u)=>u>0&&u<=t.length?o&&(i+n[u-1][0]+n[u-1][1])%t[u-1]===0:o,!0),()=>`input spatial dimensions ${s.shape.slice(1)} with paddings ${n.toString()} must be divisible by blockShapes ${t.toString()}`);const r={x:s},a={blockShape:t,paddings:n};return N.runKernel(Mu,r,a)}const Va=b({spaceToBatchND_:Lm});/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Pm(e,t,n,s,r,a,o){r==null&&(r=[1,1]),a==null&&(a=1),s===0&&(s="valid");const i=m(e,"x","maxPool");let u=i,c=!1;i.rank===3&&(c=!0,u=v(i,[1,i.shape[0],i.shape[1],i.shape[2]])),y(Kt(a,r),()=>`Error in pool: Either strides or dilations must be 1. Got strides ${a} and dilations '${r}'`);const h=Dp(u.shape,t,a,r,s),p=[h.dilationHeight,h.dilationWidth];let f;s==="same"?f=zm([h.filterHeight,h.filterWidth],p):f=[[0,0],[0,0]];const d=p[0]===1&&p[1]===1,[w,T]=Rm([h.inHeight,h.inWidth],p,f),S=d?s:"valid",$=d?u:Va(u,p,w),I=(n==="avg"?()=>wa($,t,a,S,o):()=>Pa($,t,a,S,o))(),_=d?I:Na(I,p,T);return c?v(_,[_.shape[1],_.shape[2],_.shape[3]]):_}function Rm(e,t,n){const s=n.map(h=>h[0]),r=n.map(h=>h[1]),a=e.concat(s,r),o=t.map((h,p)=>(h-a[p]%h)%h),i=r.map((h,p)=>h+o[p]),u=t.map((h,p)=>[s[p],i[p]]),c=t.map((h,p)=>[0,o[p]]);return[u,c]}function zm(e,t){const s=e.map((o,i)=>o+(o-1)*(t[i]-1)).map(o=>o-1),r=s.map(o=>Math.floor(o/2)),a=s.map((o,i)=>o-r[i]);return s.map((o,i)=>[r[i],a[i]])}const Vm=b({pool_:Pm});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function qm(e,t){const n=m(e,"x","prelu"),s=m(t,"alpha","prelu"),r={x:n,alpha:s};return N.runKernel(Tu,r)}const qa=b({prelu_:qm});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Um(e,t=null,n=!1){let s=m(e,"x","prod");s.dtype==="bool"&&(s=st(s,"int32"));const r={x:s},a={axis:t,keepDims:n};return N.runKernel(Su,r,a)}const Wm=b({prod_:Um});/**
 * @license
 * Copyright 2022 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function jm(e,t,n,s){const r=e.map((h,p)=>m(h,`tensors${p}`,"raggedGather","int32")),a=m(t,"paramsDenseValues","raggedGather"),o=m(n,"indices","raggedGather","int32"),i={paramsNestedSplits:r,paramsDenseValues:a,indices:o},u={outputRaggedRank:s},c=N.runKernel($u,i,u);return{outputNestedSplits:c.slice(0,c.length-1),outputDenseValues:c[c.length-1]}}const Km=b({raggedGather_:jm});/**
 * @license
 * Copyright 2022 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Hm(e,t,n,s,r){const a=m(e,"shape","raggedTensorToTensor","int32"),o=m(t,"values","raggedTensorToTensor"),i=m(n,"defaultValue","raggedTensorToTensor",o.dtype),u=s.map((p,f)=>m(p,`tensors${f}`,"raggedTensorToTensor","int32")),c={shape:a,values:o,defaultValue:i,rowPartitionTensors:u},h={rowPartitionTypes:r};return N.runKernel(ku,c,h)}const Gm=b({raggedTensorToTensor_:Hm});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Mm(e,t,n){const s=Q(e);let r=null;if(n==null||n==="float32")r=new Float32Array(s);else if(n==="int32")r=new Int32Array(s);else if(n==="bool")r=new Uint8Array(s);else throw new Error(`Unknown data type ${n}`);for(let a=0;a<s;a++)r[a]=t();return N.makeTensor(r,e,n)}const Xm=b({rand_:Mm});var Ge={exports:{}},Ym=Ge.exports,ir;function Jm(){return ir||(ir=1,(function(e){(function(t,n,s){function r(u){var c=this,h=i();c.next=function(){var p=2091639*c.s0+c.c*23283064365386963e-26;return c.s0=c.s1,c.s1=c.s2,c.s2=p-(c.c=p|0)},c.c=1,c.s0=h(" "),c.s1=h(" "),c.s2=h(" "),c.s0-=h(u),c.s0<0&&(c.s0+=1),c.s1-=h(u),c.s1<0&&(c.s1+=1),c.s2-=h(u),c.s2<0&&(c.s2+=1),h=null}function a(u,c){return c.c=u.c,c.s0=u.s0,c.s1=u.s1,c.s2=u.s2,c}function o(u,c){var h=new r(u),p=c&&c.state,f=h.next;return f.int32=function(){return h.next()*4294967296|0},f.double=function(){return f()+(f()*2097152|0)*11102230246251565e-32},f.quick=f,p&&(typeof p=="object"&&a(p,h),f.state=function(){return a(h,{})}),f}function i(){var u=4022871197,c=function(h){h=String(h);for(var p=0;p<h.length;p++){u+=h.charCodeAt(p);var f=.02519603282416938*u;u=f>>>0,f-=u,f*=u,u=f>>>0,f-=u,u+=f*4294967296}return(u>>>0)*23283064365386963e-26};return c}n&&n.exports?n.exports=o:this.alea=o})(Ym,e)})(Ge)),Ge.exports}var Me={exports:{}},Zm=Me.exports,ur;function Qm(){return ur||(ur=1,(function(e){(function(t,n,s){function r(i){var u=this,c="";u.x=0,u.y=0,u.z=0,u.w=0,u.next=function(){var p=u.x^u.x<<11;return u.x=u.y,u.y=u.z,u.z=u.w,u.w^=u.w>>>19^p^p>>>8},i===(i|0)?u.x=i:c+=i;for(var h=0;h<c.length+64;h++)u.x^=c.charCodeAt(h)|0,u.next()}function a(i,u){return u.x=i.x,u.y=i.y,u.z=i.z,u.w=i.w,u}function o(i,u){var c=new r(i),h=u&&u.state,p=function(){return(c.next()>>>0)/4294967296};return p.double=function(){do var f=c.next()>>>11,d=(c.next()>>>0)/4294967296,w=(f+d)/(1<<21);while(w===0);return w},p.int32=c.next,p.quick=p,h&&(typeof h=="object"&&a(h,c),p.state=function(){return a(c,{})}),p}n&&n.exports?n.exports=o:this.xor128=o})(Zm,e)})(Me)),Me.exports}var Xe={exports:{}},td=Xe.exports,cr;function ed(){return cr||(cr=1,(function(e){(function(t,n,s){function r(i){var u=this,c="";u.next=function(){var p=u.x^u.x>>>2;return u.x=u.y,u.y=u.z,u.z=u.w,u.w=u.v,(u.d=u.d+362437|0)+(u.v=u.v^u.v<<4^(p^p<<1))|0},u.x=0,u.y=0,u.z=0,u.w=0,u.v=0,i===(i|0)?u.x=i:c+=i;for(var h=0;h<c.length+64;h++)u.x^=c.charCodeAt(h)|0,h==c.length&&(u.d=u.x<<10^u.x>>>4),u.next()}function a(i,u){return u.x=i.x,u.y=i.y,u.z=i.z,u.w=i.w,u.v=i.v,u.d=i.d,u}function o(i,u){var c=new r(i),h=u&&u.state,p=function(){return(c.next()>>>0)/4294967296};return p.double=function(){do var f=c.next()>>>11,d=(c.next()>>>0)/4294967296,w=(f+d)/(1<<21);while(w===0);return w},p.int32=c.next,p.quick=p,h&&(typeof h=="object"&&a(h,c),p.state=function(){return a(c,{})}),p}n&&n.exports?n.exports=o:this.xorwow=o})(td,e)})(Xe)),Xe.exports}var Ye={exports:{}},nd=Ye.exports,lr;function sd(){return lr||(lr=1,(function(e){(function(t,n,s){function r(i){var u=this;u.next=function(){var h=u.x,p=u.i,f,d;return f=h[p],f^=f>>>7,d=f^f<<24,f=h[p+1&7],d^=f^f>>>10,f=h[p+3&7],d^=f^f>>>3,f=h[p+4&7],d^=f^f<<7,f=h[p+7&7],f=f^f<<13,d^=f^f<<9,h[p]=d,u.i=p+1&7,d};function c(h,p){var f,d=[];if(p===(p|0))d[0]=p;else for(p=""+p,f=0;f<p.length;++f)d[f&7]=d[f&7]<<15^p.charCodeAt(f)+d[f+1&7]<<13;for(;d.length<8;)d.push(0);for(f=0;f<8&&d[f]===0;++f);for(f==8?d[7]=-1:d[f],h.x=d,h.i=0,f=256;f>0;--f)h.next()}c(u,i)}function a(i,u){return u.x=i.x.slice(),u.i=i.i,u}function o(i,u){i==null&&(i=+new Date);var c=new r(i),h=u&&u.state,p=function(){return(c.next()>>>0)/4294967296};return p.double=function(){do var f=c.next()>>>11,d=(c.next()>>>0)/4294967296,w=(f+d)/(1<<21);while(w===0);return w},p.int32=c.next,p.quick=p,h&&(h.x&&a(h,c),p.state=function(){return a(c,{})}),p}n&&n.exports?n.exports=o:this.xorshift7=o})(nd,e)})(Ye)),Ye.exports}var Je={exports:{}},rd=Je.exports,pr;function ad(){return pr||(pr=1,(function(e){(function(t,n,s){function r(i){var u=this;u.next=function(){var h=u.w,p=u.X,f=u.i,d,w;return u.w=h=h+1640531527|0,w=p[f+34&127],d=p[f=f+1&127],w^=w<<13,d^=d<<17,w^=w>>>15,d^=d>>>12,w=p[f]=w^d,u.i=f,w+(h^h>>>16)|0};function c(h,p){var f,d,w,T,S,$=[],O=128;for(p===(p|0)?(d=p,p=null):(p=p+"\0",d=0,O=Math.max(O,p.length)),w=0,T=-32;T<O;++T)p&&(d^=p.charCodeAt((T+32)%p.length)),T===0&&(S=d),d^=d<<10,d^=d>>>15,d^=d<<4,d^=d>>>13,T>=0&&(S=S+1640531527|0,f=$[T&127]^=d+S,w=f==0?w+1:0);for(w>=128&&($[(p&&p.length||0)&127]=-1),w=127,T=512;T>0;--T)d=$[w+34&127],f=$[w=w+1&127],d^=d<<13,f^=f<<17,d^=d>>>15,f^=f>>>12,$[w]=d^f;h.w=S,h.X=$,h.i=w}c(u,i)}function a(i,u){return u.i=i.i,u.w=i.w,u.X=i.X.slice(),u}function o(i,u){i==null&&(i=+new Date);var c=new r(i),h=u&&u.state,p=function(){return(c.next()>>>0)/4294967296};return p.double=function(){do var f=c.next()>>>11,d=(c.next()>>>0)/4294967296,w=(f+d)/(1<<21);while(w===0);return w},p.int32=c.next,p.quick=p,h&&(h.X&&a(h,c),p.state=function(){return a(c,{})}),p}n&&n.exports?n.exports=o:this.xor4096=o})(rd,e)})(Je)),Je.exports}var Ze={exports:{}},od=Ze.exports,hr;function id(){return hr||(hr=1,(function(e){(function(t,n,s){function r(i){var u=this,c="";u.next=function(){var p=u.b,f=u.c,d=u.d,w=u.a;return p=p<<25^p>>>7^f,f=f-d|0,d=d<<24^d>>>8^w,w=w-p|0,u.b=p=p<<20^p>>>12^f,u.c=f=f-d|0,u.d=d<<16^f>>>16^w,u.a=w-p|0},u.a=0,u.b=0,u.c=-1640531527,u.d=1367130551,i===Math.floor(i)?(u.a=i/4294967296|0,u.b=i|0):c+=i;for(var h=0;h<c.length+20;h++)u.b^=c.charCodeAt(h)|0,u.next()}function a(i,u){return u.a=i.a,u.b=i.b,u.c=i.c,u.d=i.d,u}function o(i,u){var c=new r(i),h=u&&u.state,p=function(){return(c.next()>>>0)/4294967296};return p.double=function(){do var f=c.next()>>>11,d=(c.next()>>>0)/4294967296,w=(f+d)/(1<<21);while(w===0);return w},p.int32=c.next,p.quick=p,h&&(typeof h=="object"&&a(h,c),p.state=function(){return a(c,{})}),p}n&&n.exports?n.exports=o:this.tychei=o})(od,e)})(Ze)),Ze.exports}var Qe={exports:{}},ud=Nc(ro),cd=Qe.exports,fr;function ld(){return fr||(fr=1,(function(e){(function(t,n,s){var r=256,a=6,o=52,i="random",u=s.pow(r,a),c=s.pow(2,o),h=c*2,p=r-1,f;function d(_,A,D){var B=[];A=A==!0?{entropy:!0}:A||{};var F=$(S(A.entropy?[_,I(n)]:_??O(),3),B),E=new w(B),k=function(){for(var g=E.g(a),x=u,C=0;g<c;)g=(g+C)*r,x*=r,C=E.g(1);for(;g>=h;)g/=2,x/=2,C>>>=1;return(g+C)/x};return k.int32=function(){return E.g(4)|0},k.quick=function(){return E.g(4)/4294967296},k.double=k,$(I(E.S),n),(A.pass||D||function(g,x,C,L){return L&&(L.S&&T(L,E),g.state=function(){return T(E,{})}),C?(s[i]=g,x):g})(k,F,"global"in A?A.global:this==s,A.state)}function w(_){var A,D=_.length,B=this,F=0,E=B.i=B.j=0,k=B.S=[];for(D||(_=[D++]);F<r;)k[F]=F++;for(F=0;F<r;F++)k[F]=k[E=p&E+_[F%D]+(A=k[F])],k[E]=A;(B.g=function(g){for(var x,C=0,L=B.i,P=B.j,q=B.S;g--;)x=q[L=p&L+1],C=C*r+q[p&(q[L]=q[P=p&P+x])+(q[P]=x)];return B.i=L,B.j=P,C})(r)}function T(_,A){return A.i=_.i,A.j=_.j,A.S=_.S.slice(),A}function S(_,A){var D=[],B=typeof _,F;if(A&&B=="object")for(F in _)try{D.push(S(_[F],A-1))}catch{}return D.length?D:B=="string"?_:_+"\0"}function $(_,A){for(var D=_+"",B,F=0;F<D.length;)A[p&F]=p&(B^=A[p&F]*19)+D.charCodeAt(F++);return I(A)}function O(){try{var _;return f&&(_=f.randomBytes)?_=_(r):(_=new Uint8Array(r),(t.crypto||t.msCrypto).getRandomValues(_)),I(_)}catch{var A=t.navigator,D=A&&A.plugins;return[+new Date,t,D,t.screen,I(n)]}}function I(_){return String.fromCharCode.apply(0,_)}if($(s.random(),n),e.exports){e.exports=d;try{f=ud}catch{}}else s["seed"+i]=d})(typeof self<"u"?self:cd,[],Math)})(Qe)),Qe.exports}var Bn,mr;function pd(){if(mr)return Bn;mr=1;var e=Jm(),t=Qm(),n=ed(),s=sd(),r=ad(),a=id(),o=ld();return o.alea=e,o.xor128=t,o.xorwow=n,o.xorshift7=s,o.xor4096=r,o.tychei=a,Bn=o,Bn}var Os=pd();/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */class Fs{constructor(t,n,s,r,a){this.mean=t,this.stdDev=n,this.dtype=s,this.nextVal=NaN,this.truncated=r,this.truncated&&(this.upper=this.mean+this.stdDev*2,this.lower=this.mean-this.stdDev*2);const o=a||Math.random();this.random=Os.alea(o.toString())}nextValue(){if(!isNaN(this.nextVal)){const r=this.nextVal;return this.nextVal=NaN,r}let t,n,s=!1;for(;!s;){let r,a,o;do r=2*this.random()-1,a=2*this.random()-1,o=r*r+a*a;while(o>=1||o===0);const i=Math.sqrt(-2*Math.log(o)/o);t=this.mean+this.stdDev*r*i,n=this.mean+this.stdDev*a*i,(!this.truncated||this.isValidTruncated(t))&&(s=!0)}return(!this.truncated||this.isValidTruncated(n))&&(this.nextVal=this.convertValue(n)),this.convertValue(t)}convertValue(t){return this.dtype==null||this.dtype==="float32"?t:Math.round(t)}isValidTruncated(t){return t<=this.upper&&t>=this.lower}}class hd{constructor(t,n,s,r){this.alpha=t,this.beta=1/n,this.dtype=s;const a=r||Math.random();this.randu=Os.alea(a.toString()),this.randn=new Fs(0,1,s,!1,this.randu()),t<1?this.d=t+2/3:this.d=t-1/3,this.c=1/Math.sqrt(9*this.d)}nextValue(){let t,n,s,r,a,o;for(;;){do r=this.randn.nextValue(),o=1+this.c*r;while(o<=0);if(o*=o*o,t=r*r,n=1-.331*t*t,s=.5*t+this.d*(1-o+Math.log(o)),a=this.randu(),a<n||Math.log(a)<s)break}return o=1/this.beta*this.d*o,this.alpha<1&&(o*=Math.pow(this.randu(),1/this.alpha)),this.convertValue(o)}convertValue(t){return this.dtype==="float32"?t:Math.round(t)}}class fd{constructor(t=0,n=1,s,r){if(this.canReturnFloat=()=>this.dtype==null||this.dtype==="float32",this.min=t,this.range=n-t,this.dtype=s,r==null&&(r=Math.random()),typeof r=="number"&&(r=r.toString()),!this.canReturnFloat()&&this.range<=1)throw new Error(`The difference between ${t} - ${n} <= 1 and dtype is not float`);this.random=Os.alea(r)}convertValue(t){return this.canReturnFloat()?t:Math.round(t)}nextValue(){return this.convertValue(this.min+this.range*this.random())}}/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function md(e,t,n=1,s="float32",r){if(n==null&&(n=1),s==null&&(s="float32"),s!=="float32"&&s!=="int32")throw new Error(`Unsupported data type ${s}`);const a=new hd(t,n,s,r),o=Ft(e,s);for(let i=0;i<o.values.length;i++)o.values[i]=a.nextValue();return o.toTensor()}const dd=b({randomGamma_:md});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function gd(e,t=0,n=1,s,r){if(s!=null&&s==="bool")throw new Error(`Unsupported data type ${s}`);const a=new Fs(t,n,s,!1,r),o=Ft(e,s);for(let i=0;i<o.values.length;i++)o.values[i]=a.nextValue();return o.toTensor()}const Ua=b({randomNormal_:gd});/**
 * @license
 * Copyright 2022 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function yd(e,t,n){if(t!=null&&t==="bool")throw new Error(`Unsupported data type ${t}`);return Ua(e,0,1,t,n)}const bd=b({randomStandardNormal_:yd});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function wd(e,t=0,n=1,s="float32",r){const a=Ft(e,s),o=new fd(t,n,null,r);for(let i=0;i<a.values.length;i++)a.values[i]=o.nextValue();return a.toTensor()}const Wa=b({randomUniform_:wd});/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Fe(e,t,n=1,s="float32"){if(n===0)throw new Error("Cannot have a step of zero");const r={start:e,stop:t,step:n,dtype:s};return N.runKernel(Eu,{},r)}/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Nd(e){const n={x:m(e,"x","reciprocal")};return N.runKernel(_u,n)}const Td=b({reciprocal_:Nd});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Sd(e){const n={x:m(e,"x","relu")};return N.runKernel(xu,n)}const _n=b({relu_:Sd});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function $d(e){const n={x:m(e,"x","relu6")};return N.runKernel(Ou,n)}const ja=b({relu6_:$d});/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function kd(e,t){const s={x:m(e,"x","reverse")},r={dims:t};return N.runKernel(Fu,s,r)}const ae=b({reverse_:kd});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Ed(e){const t=m(e,"x","reverse");return y(t.rank===1,()=>`Error in reverse1D: x must be rank 1 but got rank ${t.rank}.`),ae(t,0)}const vd=b({reverse1d_:Ed});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function _d(e,t){const n=m(e,"x","reverse");return y(n.rank===2,()=>`Error in reverse2D: x must be rank 2 but got rank ${n.rank}.`),ae(n,t)}const xd=b({reverse2d_:_d});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Id(e,t){const n=m(e,"x","reverse");return y(n.rank===3,()=>`Error in reverse3D: x must be rank 3 but got rank ${n.rank}.`),ae(n,t)}const Ad=b({reverse3d_:Id});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Dd(e,t){const n=m(e,"x","reverse");return y(n.rank===4,()=>`Error in reverse4D: x must be rank 4 but got rank ${n.rank}.`),ae(n,t)}const Od=b({reverse4d_:Dd});/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Fd(e){const n={x:m(e,"x","round")};return N.runKernel(Cu,n)}const Ka=b({round_:Fd});/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Cd(e){const n={x:m(e,"x","rsqrt","float32")};return N.runKernel(Bu,n)}const Bd=b({rsqrt_:Cd});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Ld(e){const n={x:m(e,"x","selu")};return N.runKernel(zu,n)}const Pd=b({selu_:Ld});function Rd(e,t,n,s,r,a=[1,1],o="NHWC"){const i=m(e,"x","separableConv2d"),u=m(t,"depthwiseFilter","separableConv2d"),c=m(n,"pointwiseFilter","separableConv2d");let h=i,p=!1;if(i.rank===3&&(p=!0,h=v(i,[1,i.shape[0],i.shape[1],i.shape[2]])),o==="NCHW")throw new Error("separableConv2d currently does not support dataFormat NCHW; only NHWC is supported");y(h.rank===4,()=>`Error in separableConv2d: input must be rank 4, but got rank ${h.rank}.`),y(u.rank===4,()=>`Error in separableConv2d: depthwise filter must be rank 4, but got rank ${u.rank}.`),y(c.rank===4,()=>`Error in separableConv2d: pointwise filter must be rank 4, but got rank ${u.rank}.`),y(c.shape[0]===1,()=>`Error in separableConv2d: the first dimension of pointwise filter  must be 1, but got ${c.shape[0]}.`),y(c.shape[1]===1,()=>`Error in separableConv2d: the second dimension of pointwise filter must be 1, but got ${c.shape[1]}.`);const f=u.shape[2],d=u.shape[3];y(c.shape[2]===f*d,()=>`Error in separableConv2d: the third dimension of pointwise filter must be ${f*d}, but got ${c.shape[2]}.`);const w=_s(h,u,s,r,o,a),S=Tn(w,c,1,"valid",o);return p?v(S,[S.shape[1],S.shape[2],S.shape[3]]):S}const zd=b({separableConv2d_:Rd});/**
 * @license
 * Copyright 2020 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */async function Vd(e,t){const n=m(e,"x","setdiff1d"),s=m(t,"y","setdiff1d");y(n.dtype===s.dtype,()=>`x and y should have the same dtype, but got x (${n.dtype}) and y (${s.dtype}).`),y(n.rank===1,()=>`x should be 1D tensor, but got x (${n.shape}).`),y(s.rank===1,()=>`y should be 1D tensor, but got y (${s.shape}).`);const r=await n.data(),a=await s.data(),o=new Set(a);let i=0;for(let h=0;h<r.length;h++)o.has(r[h])||i++;const u=new qn([i],n.dtype),c=new qn([i],"int32");for(let h=0,p=0;h<r.length;h++)o.has(r[h])||(u.values[p]=r[h],c.values[p]=h,p++);return[u.toTensor(),c.toTensor()]}const qd=Vd;/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Ud(e){const n={x:m(e,"x","sign")};return N.runKernel(Wu,n)}const Wd=b({sign_:Ud});/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function jd(e){const n={x:m(e,"x","sin","float32")};return N.runKernel(qu,n)}const Kd=b({sin_:jd});/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Hd(e){const n={x:m(e,"x","sinh")};return N.runKernel(Uu,n)}const Gd=b({sinh_:Hd});/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Md(e,t,n){const s=m(e,"x","slice1d");return y(s.rank===1,()=>`slice1d expects a rank-1 tensor, but got a rank-${s.rank} tensor`),K(s,[t],[n])}const Xd=b({slice1d_:Md});/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Yd(e,t,n){const s=m(e,"x","slice2d");return y(s.rank===2,()=>`slice2d expects a rank-2 tensor, but got a rank-${s.rank} tensor`),K(s,t,n)}const Jd=b({slice2d_:Yd});/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Zd(e,t,n){const s=m(e,"x","slice3d");return y(s.rank===3,()=>`slice3d expects a rank-3 tensor, but got a rank-${s.rank} tensor`),K(s,t,n)}const Qd=b({slice3d_:Zd});/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function tg(e,t,n){const s=m(e,"x","slice4d");return y(s.rank===4,()=>`slice4d expects a rank-4 tensor, but got a rank-${s.rank} tensor`),K(s,t,n)}const eg=b({slice4d_:tg});/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function ng(e,t=-1){const n=m(e,"logits","softmax","float32");if(t===-1&&(t=n.rank-1),t!==n.rank-1)throw Error(`Softmax along a non-last dimension is not yet supported. Logits was rank ${n.rank} and dim was ${t}`);const s={logits:n},r={dim:t};return N.runKernel(Yu,s,r)}const sg=b({softmax_:ng});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function rg(e){y(e.dtype==="complex64",()=>`The dtype for tf.spectral.fft() must be complex64 but got ${e.dtype}.`);const t={input:e};return N.runKernel(xi,t)}const Cs=b({fft_:rg});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function ag(e){y(e.dtype==="complex64",()=>`The dtype for tf.spectral.ifft() must be complex64 but got ${e.dtype}.`);const t={input:e};return N.runKernel(Ri,t)}const ln=b({ifft_:ag});/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function og(e){const t=e.shape[e.shape.length-1],n=e.size/t;let s;if(t<=2){const r=v(e,[n,t]);s=ln(r)}else{const r=[n,2*(t-1)],a=v(De(e),[n,t]),o=v(yn(e),[n,t]),i=ae(K(a,[0,1],[n,t-2]),1),u=z(ae(K(o,[0,1],[n,t-2]),1),U(-1)),c=pt([a,i],1),h=pt([o,u],1),p=v(Ut(c,h),[r[0],r[1]]);s=ln(p)}if(s=De(s),e.rank===3&&e.shape[0]!==0){const r=s,a=e.shape[0];s=v(s,[a,s.shape[0]/a,s.shape[1]]),r.dispose()}return s}const Ha=b({irfft_:og});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function ig(e,t,n=0){const r={x:m(e,"x","split")},a={numOrSizeSplits:t,axis:n};return N.runKernel(Xu,r,a)}const Ce=b({split_:ig});/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function ug(e,t){y(e.dtype==="float32",()=>`The dtype for rfft() must be real value but got ${e.dtype}`);let n=e.shape[e.shape.length-1];const s=e.size/n;let r;if(t!=null&&t<n){const w=e.shape.map(S=>0),T=e.shape.map(S=>S);T[e.shape.length-1]=t,r=K(e,w,T),n=t}else if(t!=null&&t>n){const w=e.shape.map(T=>T);w[e.shape.length-1]=t-n,r=pt([e,we(w)],e.shape.length-1),n=t}else r=e;const a=xs(r),o=v(Ut(r,a),[s,n]),i=Cs(o),u=Math.floor(n/2)+1,c=De(i),h=yn(i),p=Ce(c,[u,n-u],c.shape.length-1),f=Ce(h,[u,n-u],h.shape.length-1),d=r.shape.slice();return d[r.shape.length-1]=u,v(Ut(p[0],f[0]),d)}const Bs=b({rfft_:ug});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function cg(e,t){let n=m(e,"a","squaredDifference"),s=m(t,"b","squaredDifference");[n,s]=X(n,s),tt(n.shape,s.shape);const r={a:n,b:s},a={};return N.runKernel(nc,r,a)}const Ga=b({squaredDifference_:cg});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function lg(e,t){const n=m(e,"x","squeeze","string_or_numeric");return v(n,vr(n.shape,t).newShape)}const Ls=b({squeeze_:lg});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function pg(e,t=0){const n=Ae(e,"tensors","stack","string_or_numeric");y(n.length>=1,()=>"Pass at least one tensor to tf.stack"),n.length>0&&y(t<=n[0].rank,()=>"Axis must be <= rank of the tensor");const s=n,r={axis:t};return N.runKernel(bu,s,r)}const Bt=b({stack_:pg});/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function hg(e,t=0){const s={x:m(e,"x","step")},r={alpha:t};return N.runKernel(gc,s,r)}const Ma=b({step_:hg});/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function fg(e,t,n,s,r=0,a=0,o=0,i=0,u=0){const h={x:m(e,"x","stridedSlice","string_or_numeric")},p={begin:t,end:n,strides:s,beginMask:r,endMask:a,ellipsisMask:o,newAxisMask:i,shrinkAxisMask:u};return N.runKernel(sc,h,p)}const mg=b({stridedSlice_:fg});/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function dg(e){const n={x:m(e,"x","tan","float32")};return N.runKernel(uc,n)}const gg=b({tan_:dg});/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function $t(e,t){ie(e);const n=Wt(e,t);if(n.length!==1)throw new Error("tensor1d() requires values to be a flat/TypedArray");return jt(e,null,n,t)}/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function _e(e,t,n){if(ie(e),t!=null&&t.length!==2)throw new Error("tensor2d() requires shape to have two numbers");const s=Wt(e,n);if(s.length!==2&&s.length!==1)throw new Error("tensor2d() requires values to be number[][] or flat/TypedArray");if(s.length===1&&t==null)throw new Error("tensor2d() requires shape to be provided when `values` are a flat/TypedArray");return jt(e,t,s,n)}/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function yg(e,t,n){if(ie(e),t!=null&&t.length!==4)throw new Error("tensor4d() requires shape to have four numbers");const s=Wt(e,n);if(s.length!==4&&s.length!==1)throw new Error("tensor4d() requires values to be number[][][][] or flat/TypedArray");if(s.length===1&&t==null)throw new Error("tensor4d() requires shape to be provided when `values` are a flat array");return jt(e,t,s,n)}/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function bg(e,t,n){if(ie(e),t!=null&&t.length!==5)throw new Error("tensor5d() requires shape to have five numbers");const s=Wt(e,n);if(s.length!==5&&s.length!==1)throw new Error("tensor5d() requires values to be number[][][][][] or flat/TypedArray");if(s.length===1&&t==null)throw new Error("tensor5d() requires shape to be provided when `values` are a flat array");return jt(e,t,s,n)}/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function wg(e,t,n){if(ie(e),t!=null&&t.length!==6)throw new Error("tensor6d() requires shape to have six numbers");const s=Wt(e,n);if(s.length!==6&&s.length!==1)throw new Error("tensor6d() requires values to be number[][][][][][] or flat/TypedArray");if(s.length===1&&t==null)throw new Error("tensor6d() requires shape to be provided when `values` are a flat array");return t=t||s,jt(e,t,s,n)}/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Ng(e,t=1,n=!0){const s=m(e,"x","topk");if(s.rank===0)throw new Error("topk() expects the input to be of rank 1 or higher");const r=s.shape[s.shape.length-1];if(t<0)throw new Error(`'k' passed to topk() must be >= 0 but got ${t}`);if(t>r)throw new Error(`'k' passed to topk() must be <= the last dimension (${r}) but got ${t}`);const a={x:s},o={k:t,sorted:n},[i,u]=N.runKernel(lc,a,o);return{values:i,indices:u}}const Tg=b({topk_:Ng});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Sg(e,t=0,n=1,s,r){if(s!=null&&s==="bool")throw new Error("Unsupported data type $ { dtype }");const a=new Fs(t,n,s,!0,r),o=Ft(e,s);for(let i=0;i<o.values.length;i++)o.values[i]=a.nextValue();return o.toTensor()}const $g=b({truncatedNormal_:Sg});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function kg(e,t=0){const n=m(e,"x","unique","string_or_numeric");y(n.rank>0,()=>"The input tensor must be at least 1D");const s={x:n},r={axis:t},[a,o]=N.runKernel(hc,s,r);return{values:a,indices:o}}const Eg=b({unique_:kg});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function vg(e,t,n){const s=m(e,"x","unsortedSegmentSum"),r=m(t,"segmentIds","unsortedSegmentSum","int32");y(de(n),()=>"numSegments must be of dtype int");const a={x:s,segmentIds:r},o={numSegments:n};return N.runKernel(mc,a,o)}const _g=b({unsortedSegmentSum_:vg});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function xg(e,t=0){const n=m(e,"x","unstack","string_or_numeric");y(t>=-n.shape.length&&t<n.shape.length,()=>`Axis = ${t} is not in [-${n.shape.length}, ${n.shape.length})`);const s={value:n},r={axis:t};return N.runKernel(fc,s,r)}const ue=b({unstack_:xg});/**
 * @license
 * Copyright 2022 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Ig(e,t){return Ds(e,t,"right")}/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Ag(e,t=!0,n,s){return N.makeVariable(e,t,n,s)}/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Dg(e,t){const n=[];for(let a=0;a<t.length;a++)t[a]&&n.push(a);const s=Ft(e,"int32"),r=Ft([n.length,e.length],"int32");for(let a=0;a<n.length;a++){const o=s.indexToLoc(n[a]),i=a*e.length;r.values.set(o,i)}return r.toTensor()}/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */async function Og(e){const t=m(e,"condition","whereAsync","bool"),n=await t.data(),s=Dg(t.shape,n);return e!==t&&t.dispose(),s}const Xa=Og;/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */async function Fg(e,t,n){const s=m(e,"tensor","boolMask"),r=m(t,"mask","boolMask","bool"),a=n??0,o=r.rank,i=s.shape;y(o>0,()=>"mask cannot be scalar"),ht(i.slice(a,a+o),r.shape,"mask's shape must match the first K dimensions of tensor's shape,");let u=1;for(let T=a;T<a+o;T++)u*=i[T];const c=i.slice(0,a).concat([u],i.slice(a+o)),h=v(s,c),p=v(r,[-1]),f=await Xa(p),d=Ls(f,[1]),w=Ia(h,d,a);return e!==s&&s.dispose(),t!==r&&r.dispose(),d.dispose(),h.dispose(),p.dispose(),f.dispose(),w}const Cg=Fg;/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Bg(e,t,n,s,r=!0){const a=m(e,"v","movingAverage"),o=m(t,"x","movingAverage"),i=m(n,"decay","movingAverage");Gr(a,o),y(Ot(a.shape,o.shape),()=>"Shape mismatch in v and x");const u=U(1),c=V(u,i);let h=z(V(o,a),c);if(r){y(s!=null,()=>"When using zeroDebias: true, step is required.");const p=m(s,"step","movingAverage");h=lt(h,V(u,Is(i,p)))}return rt(a,h)}const Lg=b({movingAverage_:Bg});/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Pg(e,t,n){const s=m(e,"indices","scatterND","int32"),r=m(t,"updates","scatterND");ga(r,s,n);const a={indices:s,updates:r},o={shape:n};return N.runKernel(Lu,a,o)}const Rg=b({scatterND_:Pg});function zg(e,t,n,s){if(e.dtype!=="int32")throw new Error(`tf.sparseToDense() expects the indices to be int32 type, but the dtype was ${e.dtype}.`);if(e.rank>2)throw new Error(`sparseIndices should be a scalar, vector, or matrix, but got shape ${e.shape}.`);const r=e.rank>0?e.shape[0]:1,a=e.rank>1?e.shape[1]:1;if(n.length!==a)throw new Error(`outputShape has incorrect number of elements:, ${n.length}, should be: ${a}.`);const o=t.size;if(!(t.rank===0||t.rank===1&&o===r))throw new Error(`sparseValues has incorrect shape ${t.shape}, should be [] or [${r}]`);if(t.dtype!==s.dtype)throw new Error("sparseValues.dtype must match defaultValues.dtype")}/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Vg(e,t,n,s=0){const r=m(e,"sparseIndices","sparseToDense","int32"),a=m(t,"sparseValues","sparseToDense","string_or_numeric"),o=m(s,"defaultValue","sparseToDense",a.dtype);zg(r,a,n,o);const i={sparseIndices:r,sparseValues:a,defaultValue:o},u={outputShape:n};return N.runKernel(ec,i,u)}const qg=b({sparseToDense_:Vg});/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Ug(e,t){const n=m(t,"indices","gatherND","int32"),r={params:m(e,"x","gatherND","string_or_numeric"),indices:n};return N.runKernel(Bi,r)}const Wg=b({gatherND_:Ug});/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function jg(e,t){if(t==null)return e.shape.slice();if(Ot(e.shape,t))return t;if(e.shape.length===t.length){const n=[];for(let s=0;s<e.shape.length;s++)t[s]==null&&e.shape[s]!=null?n.push(e.shape[s]):n.push(t[s]);return n}return t}/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Kg(e,t,n,s){const r=m(e,"x","dropout");if(y(r.dtype==="float32",()=>`x has to be a floating point tensor since it's going to be scaled, but got a ${r.dtype} tensor instead.`),y(t>=0&&t<1,()=>`rate must be a float in the range [0, 1), but got ${t}.`),t===0)return e instanceof Z?r.clone():r;const a=jg(r,n),o=1-t,i=lt(xa(rt(Wa(a,0,1,"float32",s),o)),o);return z(r,i)}const Hg=b({dropout_:Kg});/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Ya(e){return Math.floor(Math.pow(2,Math.ceil(Math.log(e)/Math.log(2))))}function Ps(e,t,n){const s=1-e%2,r=new Float32Array(e);for(let a=0;a<e;++a){const o=2*Math.PI*a/(e+s-1);r[a]=t-n*Math.cos(o)}return $t(r,"float32")}/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */async function Gg(e,t,n=1){const s=m(e,"predictions","inTopK"),r=m(t,"targets","inTopK");y(s.rank>1,()=>`inTopK() expects the predictions to be of rank 2 or higher, but got ${s.rank}`),y(s.rank-1===r.rank,()=>`predictions rank should be 1 larger than targets rank, but got predictions rank ${s.rank} and targets rank ${r.rank}`),ht(s.shape.slice(0,s.shape.length-1),r.shape,"predictions's shape should be align with the targets' shape, except the last dimension.");const a=s.shape[s.shape.length-1];y(n>0&&n<=a,()=>`'k' passed to inTopK() must be > 0 && <= the predictions last dimension (${a}), but got ${n}`);const o=await s.data(),i=await r.data(),[u,c]=[o.length/a,a],h=_r("bool",u);for(let p=0;p<u;p++){const f=p*c,d=o.subarray(f,f+c),w=[];for(let T=0;T<d.length;T++)w.push({value:d[T],index:T});w.sort((T,S)=>S.value-T.value),h[p]=0;for(let T=0;T<n;T++)if(w[T].index===i[p]){h[p]=1;break}}return e!==s&&s.dispose(),t!==r&&r.dispose(),xt(h,r.shape,"bool")}const Mg=Gg;/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Xg(e,t,n,s,r,a="NHWC",o){let i=e;e.rank===3&&(i=v(e,[1,e.shape[0],e.shape[1],e.shape[2]]));let u=t;u.rank===3&&(u=v(t,[1,t.shape[0],t.shape[1],t.shape[2]])),y(i.rank===4,()=>`Error in conv2dDerFilter: input must be rank 4, but got shape ${i.shape}.`),y(u.rank===4,()=>`Error in conv2dDerFilter: dy must be rank 4, but got shape ${u.shape}.`),y(n.length===4,()=>`Error in conv2dDerFilter: filterShape must be length 4, but got ${n}.`);const c=a==="NHWC"?i.shape[3]:i.shape[1],h=a==="NHWC"?u.shape[3]:u.shape[1];y(c===n[2],()=>`Error in conv2dDerFilter: depth of input ${c}) must match input depth in filter (${n[2]}.`),y(h===n[3],()=>`Error in conv2dDerFilter: depth of dy (${h}) must match output depth for filter (${n[3]}).`),vt("conv2dDerFilter",r,o);const p={x:i,dy:u},f={strides:s,pad:r,dataFormat:a,dimRoundingMode:o,filterShape:n};return N.runKernel(ri,p,f)}const Yg=b({conv2DBackpropFilter_:Xg});/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Rs(e,t,n){if(n==null||n==="linear")return e;if(n==="relu")return z(e,Ma(t));throw new Error(`Cannot compute gradient for fused activation ${n}.`)}function zs(e,t){let n=t;const s=ma(e.shape,t.shape);return s.length>0&&(n=H(n,s)),v(n,e.shape)}function Vs(e,t,n,s){if(t==="linear")return e;if(t==="relu")return _n(e);if(t==="elu")return ka(e);if(t==="relu6")return ja(e);if(t==="prelu")return qa(e,n);if(t==="leakyrelu")return Da(e,s);if(t==="sigmoid")return fe(e);throw new Error(`Unknown fused activation ${t}.`)}const qs=(e,t)=>!(e>0)||t==="linear";/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Jg({x:e,filter:t,strides:n,pad:s,dataFormat:r="NHWC",dilations:a=[1,1],dimRoundingMode:o,bias:i,activation:u="linear",preluActivationWeights:c,leakyreluAlpha:h}){if(u=u||"linear",qs(N.state.gradientDepth,u)===!1){y(r==="NHWC",()=>`Error in fused conv2d: got dataFormat of ${r} but only NHWC is currently supported for the case of gradient depth is 0 and the activation is not linear.`);let D=Tn(e,t,n,s,r,a,o);return i!=null&&(D=rt(D,i)),Vs(D,u,c,h)}const p=m(e,"x","conv2d","float32"),f=m(t,"filter","conv2d","float32");let d=p,w=!1;p.rank===3&&(w=!0,d=v(p,[1,p.shape[0],p.shape[1],p.shape[2]])),y(d.rank===4,()=>`Error in fused conv2d: input must be rank 4, but got rank ${d.rank}.`),y(f.rank===4,()=>`Error in fused conv2d: filter must be rank 4, but got rank ${f.rank}.`),vt("fused conv2d",s,o);const T=r==="NHWC"?d.shape[3]:d.shape[1];y(f.shape[2]===T,()=>`Error in conv2d: depth of input (${T}) must match input depth for filter ${f.shape[2]}.`),y(Kt(n,a),()=>`Error in conv2D: Either strides or dilations must be 1. Got strides ${n} and dilations '${a}'`);const S=bn(d.shape,f.shape,n,a,s,o);let $;i!=null&&($=m(i,"bias","fused conv2d"),[$]=X($,p),r==="NHWC"?tt(S.outShape,$.shape):(y($.shape.length<=1,()=>`Error in fused conv2d: only supports scalar or 1-D Tensor bias for NCHW format but got the bias of rank-${$.shape.length}.`),y($.shape.length===0||$.shape[0]===S.outChannels||$.shape[0]===1,()=>`Error in fused conv2d: bias shape (${$.shape}) is not compatible with the number of output channels (${S.outChannels})`)));let O;if(c!=null){const D=c.shape;if(y(D.length<=1||D.length===3,()=>`Error in fused conv2d: only supports scalar, 1-D Tensor or 3-D Tensor PReLU activation weights but got a tensor of rank-${D.length}.`),D.length===1)y(D[0]===1||D[0]===S.outChannels,()=>`Error in fused conv2d: PReLU activation weights (${D}) is not compatible with the number of output channels (${S.outChannels}).`);else if(D.length===3)try{tt(D,S.outShape)}catch{const F=`Error in fused conv2d: PReLU activation weights (${D}) is not compatible with the output shape of the conv2d (${S.outShape}).`;throw Error(F)}O=m(c,"prelu weights","fused conv2d")}const I=(D,B)=>{y(r==="NHWC",()=>`Error in gradient of fused conv2D: got dataFormat of ${r} but only NHWC is currently supported.`);const[F,E,k,g]=B,x=Rs(D,k,u);y(on(a),()=>`Error in gradient of fused conv2D: dilation rates greater than 1 are not yet supported in gradients. Got dilations '${a}'`);const C=Sa(E.shape,x,F,n,s),L=Yg(E,x,F.shape,n,s),P=[C,L];if(g!=null){const q=zs(g,x);P.push(q)}return P},_={x:d,filter:f,bias:$,preluActivationWeights:O},A={strides:n,pad:s,dataFormat:r,dilations:a,dimRoundingMode:o,activation:u,leakyreluAlpha:h};return i==null?Ct((B,F,E)=>{let k=N.runKernel(Gs,_,A);return E([F,B,k]),w&&(k=v(k,[k.shape[1],k.shape[2],k.shape[3]])),{value:k,gradFunc:I}})(d,f):Ct((B,F,E,k)=>{let g=N.runKernel(Gs,_,A);return k([F,B,g,E]),w&&(g=v(g,[g.shape[1],g.shape[2],g.shape[3]])),{value:g,gradFunc:I}})(d,f,$)}const Zg=b({fusedConv2d_:Jg});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Qg(e,t,n,s,r,a=[1,1],o){let i=e;e.rank===3&&(i=v(e,[1,e.shape[0],e.shape[1],e.shape[2]]));let u=t;u.rank===3&&(u=v(t,[1,t.shape[0],t.shape[1],t.shape[2]]));const c={x:i,dy:u},h={strides:s,pad:r,dimRoundingMode:o,dilations:a,filterShape:n};return N.runKernel(gi,c,h)}const ty=b({depthwiseConv2dNativeBackpropFilter_:Qg});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function ey(e,t,n,s,r,a=[1,1],o){let i=t,u=!1;t.rank===3&&(u=!0,i=v(t,[1,t.shape[0],t.shape[1],t.shape[2]]));const c={dy:i,filter:n},h={strides:s,pad:r,dimRoundingMode:o,dilations:a,inputShape:e},p=N.runKernel(yi,c,h);return u?v(p,[p.shape[1],p.shape[2],p.shape[3]]):p}const ny=b({depthwiseConv2dNativeBackpropInput_:ey});/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function sy({x:e,filter:t,strides:n,pad:s,dataFormat:r="NHWC",dilations:a=[1,1],dimRoundingMode:o,bias:i,activation:u="linear",preluActivationWeights:c,leakyreluAlpha:h}){if(qs(N.state.gradientDepth,u)===!1){let A=_s(e,t,n,s,r,a,o);return i!=null&&(A=rt(A,i)),Vs(A,u,c,h)}const p=m(e,"x","depthwiseConv2d","float32"),f=m(t,"filter","depthwiseConv2d","float32");let d=p,w=!1;p.rank===3&&(w=!0,d=v(p,[1,p.shape[0],p.shape[1],p.shape[2]])),y(d.rank===4,()=>`Error in fused depthwiseConv2d: input must be rank 4, but got rank ${d.rank}.`),y(f.rank===4,()=>`Error in fused depthwiseConv2d: filter must be rank 4, but got rank ${f.rank}.`),y(d.shape[3]===f.shape[2],()=>`Error in fused depthwiseConv2d: number of input channels (${d.shape[3]}) must match the inChannels dimension in filter ${f.shape[2]}.`),a==null&&(a=[1,1]),y(Kt(n,a),()=>`Error in fused depthwiseConv2d: Either strides or dilations must be 1. Got strides ${n} and dilations '${a}'`),vt("fused depthwiseConv2d",s,o);const T=bn(d.shape,f.shape,n,a,s,o,!0);let S;i!=null&&(S=m(i,"bias","fused conv2d"),[S]=X(S,p),tt(T.outShape,S.shape));let $;c!=null&&($=m(c,"prelu weights","fused depthwiseConv2d"));const O=(A,D)=>{y(on(a),()=>`Error in gradient of fused depthwiseConv2d: dilation rates greater than 1 are not yet supported. Got dilations '${a}'`);const[B,F,E,k]=D,g=Rs(A,E,u),x=ny(F.shape,g,B,n,s,a,o),C=ty(F,g,B.shape,n,s,a,o);if(k!=null){const L=zs(S,g);return[x,C,L]}return[x,C]},I={x:d,filter:f,bias:S,preluActivationWeights:$},_={strides:n,pad:s,dataFormat:r,dilations:a,dimRoundingMode:o,activation:u,leakyreluAlpha:h};return i==null?Ct((D,B,F)=>{let E=N.runKernel(Ms,I,_);return F([B,D,E]),w&&(E=v(E,[E.shape[1],E.shape[2],E.shape[3]])),{value:E,gradFunc:O}})(d,f):Ct((D,B,F,E)=>{let k=N.runKernel(Ms,I,_);return E([B,D,k,F]),w&&(k=v(k,[k.shape[1],k.shape[2],k.shape[3]])),{value:k,gradFunc:O}})(d,f,S)}const ry=b({fusedDepthwiseConv2d_:sy});/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function ay({a:e,b:t,transposeA:n=!1,transposeB:s=!1,bias:r,activation:a="linear",preluActivationWeights:o,leakyreluAlpha:i=.2}){if(qs(N.state.gradientDepth,a)===!1){let g=W(e,t,n,s);return r!=null&&(g=rt(g,r)),Vs(g,a,o,i)}let u=m(e,"a","fused matMul"),c=m(t,"b","fused matMul");[u,c]=X(u,c);const h=n?u.shape[u.rank-2]:u.shape[u.rank-1],p=s?c.shape[c.rank-1]:c.shape[c.rank-2],f=n?u.shape[u.rank-1]:u.shape[u.rank-2],d=s?c.shape[c.rank-2]:c.shape[c.rank-1],w=u.shape.slice(0,-2),T=c.shape.slice(0,-2),S=Q(w),$=Q(T);y(h===p,()=>`Error in fused matMul: inner shapes (${h}) and (${p}) of Tensors with shapes ${u.shape} and ${c.shape} and transposeA=${n} and transposeB=${s} must match.`);const I=tt(u.shape.slice(0,-2),c.shape.slice(0,-2)).concat([f,d]),_=n?v(u,[S,h,f]):v(u,[S,f,h]),A=s?v(c,[$,d,p]):v(c,[$,p,d]);let D;r!=null&&(D=m(r,"bias","fused matMul"),[D]=X(D,u),tt(I,D.shape));let B;o!=null&&(B=m(o,"prelu weights","fused matMul"));const F=(g,x)=>{const[C,L,P,q]=x,G=Rs(v(g,P.shape),P,a);let et,Y;if(!n&&!s?(et=W(G,L,!1,!0),Y=W(C,G,!0,!1)):!n&&s?(et=W(G,L,!1,!1),Y=W(G,C,!0,!1)):n&&!s?(et=W(L,G,!1,!0),Y=W(C,G,!1,!1)):(et=W(L,G,!0,!0),Y=W(G,C,!0,!0)),r!=null){const J=zs(q,G);return[et,Y,J]}else return[et,Y]},E={a:_,b:A,bias:D,preluActivationWeights:B},k={transposeA:n,transposeB:s,activation:a,leakyreluAlpha:i};return r==null?Ct((x,C,L)=>{const P=N.runKernel(Hs,E,k);return L([x,C,P]),{value:v(P,I),gradFunc:F}})(_,A):Ct((x,C,L,P)=>{const q=N.runKernel(Hs,E,k);return P([x,C,q,L]),{value:v(q,I),gradFunc:F}})(_,A,D)}const oy=b({fusedMatMul_:ay});/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */var iy=Object.freeze({__proto__:null,conv2d:Zg,depthwiseConv2d:ry,matMul:oy});/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function uy(e){return Ps(e,.54,.46)}const cy=b({hammingWindow_:uy});/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function ly(e){return Ps(e,.5,.5)}const Ja=b({hannWindow_:ly});/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function py(e,t,n,s=!1,r=0){let a=0;const o=[];for(;a+t<=e.size;)o.push(K(e,a,t)),a+=n;if(s)for(;a<e.size;){const i=a+t-e.size,u=pt([K(e,a,t-i),Nn([i],r)]);o.push(u),a+=n}return o.length===0?_e([],[0,t]):v(pt(o),[o.length,t])}const Za=b({frame_:py});/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function hy(e,t,n,s,r=Ja){s==null&&(s=Ya(t));const a=Za(e,t,n),o=z(a,r(t));return Bs(o,s)}const fy=b({stft_:hy});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function my(e,t,n,s,r="bilinear",a=0){const o=m(e,"image","cropAndResize"),i=m(t,"boxes","cropAndResize","float32"),u=m(n,"boxInd","cropAndResize","int32"),c=i.shape[0];y(o.rank===4,()=>`Error in cropAndResize: image must be rank 4,but got rank ${o.rank}.`),y(i.rank===2&&i.shape[1]===4,()=>`Error in cropAndResize: boxes must be have size [${c},4] but had shape ${i.shape}.`),y(u.rank===1&&u.shape[0]===c,()=>`Error in cropAndResize: boxInd must be have size [${c}] but had shape ${i.shape}.`),y(s.length===2,()=>`Error in cropAndResize: cropSize must be of length 2, but got length ${s.length}.`),y(s[0]>=1&&s[1]>=1,()=>`cropSize must be atleast [1,1], but was ${s}`),y(r==="bilinear"||r==="nearest",()=>`method must be bilinear or nearest, but was ${r}`);const h={image:o,boxes:i,boxInd:u},p={method:r,extrapolationValue:a,cropSize:s};return N.runKernel(hi,h,p)}const dy=b({cropAndResize_:my});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function gy(e){const t=m(e,"image","flipLeftRight","float32");y(t.rank===4,()=>`Error in flipLeftRight: image must be rank 4,but got rank ${t.rank}.`);const n={image:t};return N.runKernel(Ai,n,{})}const yy=b({flipLeftRight_:gy});/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function by(e){const t=m(e,"image","grayscaleToRGB"),n=t.rank-1,s=t.shape[n];y(t.rank>=2,()=>`Error in grayscaleToRGB: images must be at least rank 2, but got rank ${t.rank}.`),y(s===1,()=>`Error in grayscaleToRGB: last dimension of a grayscale image should be size 1, but got size ${s}.`);const r=new Array(t.rank);return r.fill(1,0,n),r[n]=3,ve(t,r)}const wy=b({grayscaleToRGB_:by});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Ny(e,t,n=0,s=.5){const r=m(e,"image","rotateWithOffset","float32");y(r.rank===4,()=>`Error in rotateWithOffset: image must be rank 4,but got rank ${r.rank}.`);const a={image:r},o={radians:t,fillValue:n,center:s};return N.runKernel(yc,a,o)}const Ty=b({rotateWithOffset_:Ny});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Ne(e,t,n,s,r,a){s==null&&(s=.5),r==null&&(r=Number.NEGATIVE_INFINITY),a==null&&(a=0);const o=e.shape[0];return n=Math.min(n,o),y(0<=s&&s<=1,()=>`iouThreshold must be in [0, 1], but was '${s}'`),y(e.rank===2,()=>`boxes must be a 2D tensor, but was of rank '${e.rank}'`),y(e.shape[1]===4,()=>`boxes must have 4 columns, but 2nd dimension was ${e.shape[1]}`),y(t.rank===1,()=>"scores must be a 1D tensor"),y(t.shape[0]===o,()=>`scores has incompatible shape with boxes. Expected ${o}, but was ${t.shape[0]}`),y(0<=a&&a<=1,()=>`softNmsSigma must be in [0, 1], but was '${a}'`),{maxOutputSize:n,iouThreshold:s,scoreThreshold:r,softNmsSigma:a}}/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Sy(e,t,n,s=.5,r=Number.NEGATIVE_INFINITY){const a=m(e,"boxes","nonMaxSuppression","float32"),o=m(t,"scores","nonMaxSuppression","float32"),i=Ne(a,o,n,s,r);n=i.maxOutputSize,s=i.iouThreshold,r=i.scoreThreshold;const u={maxOutputSize:n,iouThreshold:s,scoreThreshold:r};return N.runKernel(fu,{boxes:a,scores:o},u)}const $y=b({nonMaxSuppression_:Sy});/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function ky(e,t,n){const s=Ey(e,t,n),r=s<0?-(s+1):s;e.splice(r,0,t)}function Ey(e,t,n){return _y(e,t,n||vy)}function vy(e,t){return e>t?1:e<t?-1:0}function _y(e,t,n){let s=0,r=e.length,a=0,o=!1;for(;s<r;){a=s+(r-s>>>1);const i=n(t,e[a]);i>0?s=a+1:(r=a,o=!i)}return o?s:-s-1}/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function xy(e,t,n,s,r){return Us(e,t,n,s,r,0)}function Iy(e,t,n,s,r,a){return Us(e,t,n,s,r,0,!1,a,!0)}function Ay(e,t,n,s,r,a){return Us(e,t,n,s,r,a,!0)}function Us(e,t,n,s,r,a,o=!1,i=!1,u=!1){const c=[];for(let S=0;S<t.length;S++)t[S]>r&&c.push({score:t[S],boxIndex:S,suppressBeginIndex:0});c.sort(dr);const h=a>0?-.5/a:0,p=[],f=[];for(;p.length<n&&c.length>0;){const S=c.pop(),{score:$,boxIndex:O,suppressBeginIndex:I}=S;if($<r)break;let _=!1;for(let A=p.length-1;A>=I;--A){const D=Dy(e,O,p[A]);if(D>=s){_=!0;break}if(S.score=S.score*Oy(s,h,D),S.score<=r)break}S.suppressBeginIndex=p.length,_||(S.score===$?(p.push(O),f.push(S.score)):S.score>r&&ky(c,S,dr))}const d=p.length,w=n-d;i&&w>0&&(p.push(...new Array(w).fill(0)),f.push(...new Array(w).fill(0)));const T={selectedIndices:p};return o&&(T.selectedScores=f),u&&(T.validOutputs=d),T}function Dy(e,t,n){const s=e.subarray(t*4,t*4+4),r=e.subarray(n*4,n*4+4),a=Math.min(s[0],s[2]),o=Math.min(s[1],s[3]),i=Math.max(s[0],s[2]),u=Math.max(s[1],s[3]),c=Math.min(r[0],r[2]),h=Math.min(r[1],r[3]),p=Math.max(r[0],r[2]),f=Math.max(r[1],r[3]),d=(i-a)*(u-o),w=(p-c)*(f-h);if(d<=0||w<=0)return 0;const T=Math.max(a,c),S=Math.max(o,h),$=Math.min(i,p),O=Math.min(u,f),I=Math.max($-T,0)*Math.max(O-S,0);return I/(d+w-I)}function Oy(e,t,n){const s=Math.exp(t*n*n);return n<=e?s:0}function dr(e,t){return e.score-t.score||e.score===t.score&&t.boxIndex-e.boxIndex}/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */async function Fy(e,t,n,s=.5,r=Number.NEGATIVE_INFINITY){const a=m(e,"boxes","nonMaxSuppressionAsync"),o=m(t,"scores","nonMaxSuppressionAsync"),i=Ne(a,o,n,s,r);n=i.maxOutputSize,s=i.iouThreshold,r=i.scoreThreshold;const u=await Promise.all([a.data(),o.data()]),c=u[0],h=u[1],{selectedIndices:p}=xy(c,h,n,s,r);return a!==e&&a.dispose(),o!==t&&o.dispose(),$t(p,"int32")}const Cy=Fy;/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function By(e,t,n,s=.5,r=Number.NEGATIVE_INFINITY,a=0){const o=m(e,"boxes","nonMaxSuppression"),i=m(t,"scores","nonMaxSuppression"),u=Ne(o,i,n,s,r,a);n=u.maxOutputSize,s=u.iouThreshold,r=u.scoreThreshold,a=u.softNmsSigma;const c={boxes:o,scores:i},h={maxOutputSize:n,iouThreshold:s,scoreThreshold:r,softNmsSigma:a},p=N.runKernel(du,c,h);return{selectedIndices:p[0],selectedScores:p[1]}}const Ly=b({nonMaxSuppressionWithScore_:By});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */async function Py(e,t,n,s=.5,r=Number.NEGATIVE_INFINITY,a=0){const o=m(e,"boxes","nonMaxSuppressionAsync"),i=m(t,"scores","nonMaxSuppressionAsync"),u=Ne(o,i,n,s,r,a);n=u.maxOutputSize,s=u.iouThreshold,r=u.scoreThreshold,a=u.softNmsSigma;const c=await Promise.all([o.data(),i.data()]),h=c[0],p=c[1],{selectedIndices:f,selectedScores:d}=Ay(h,p,n,s,r,a);return o!==e&&o.dispose(),i!==t&&i.dispose(),{selectedIndices:$t(f,"int32"),selectedScores:$t(d)}}const Ry=Py;/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function zy(e,t,n,s=.5,r=Number.NEGATIVE_INFINITY,a=!1){const o=m(e,"boxes","nonMaxSuppression"),i=m(t,"scores","nonMaxSuppression"),u=Ne(o,i,n,s,r,null),c=u.maxOutputSize,h=u.iouThreshold,p=u.scoreThreshold,f={boxes:o,scores:i},d={maxOutputSize:c,iouThreshold:h,scoreThreshold:p,padToMaxOutputSize:a},w=N.runKernel(mu,f,d);return{selectedIndices:w[0],validOutputs:w[1]}}const Vy=b({nonMaxSuppressionPadded_:zy});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */async function qy(e,t,n,s=.5,r=Number.NEGATIVE_INFINITY,a=!1){const o=m(e,"boxes","nonMaxSuppressionAsync"),i=m(t,"scores","nonMaxSuppressionAsync"),u=Ne(o,i,n,s,r,null),c=u.maxOutputSize,h=u.iouThreshold,p=u.scoreThreshold,[f,d]=await Promise.all([o.data(),i.data()]),{selectedIndices:w,validOutputs:T}=Iy(f,d,c,h,p,a);return o!==e&&o.dispose(),i!==t&&i.dispose(),{selectedIndices:$t(w,"int32"),validOutputs:U(T,"int32")}}const Uy=qy;/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Wy(e,t,n=!1,s=!1){const r=m(e,"images","resizeBilinear");y(r.rank===3||r.rank===4,()=>`Error in resizeBilinear: x must be rank 3 or 4, but got rank ${r.rank}.`),y(t.length===2,()=>`Error in resizeBilinear: new shape must 2D, but got shape ${t}.`),y(s===!1||n===!1,()=>"Error in resizeBilinear: If halfPixelCenters is true, alignCorners must be false.");let a=r,o=!1;r.rank===3&&(o=!0,a=v(r,[1,r.shape[0],r.shape[1],r.shape[2]]));const i={images:a},u={alignCorners:n,halfPixelCenters:s,size:t},c=N.runKernel(Du,i,u);return o?v(c,[c.shape[1],c.shape[2],c.shape[3]]):c}const jy=b({resizeBilinear_:Wy});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Ky(e,t,n=!1,s=!1){const r=m(e,"images","resizeNearestNeighbor");y(r.rank===3||r.rank===4,()=>`Error in resizeNearestNeighbor: x must be rank 3 or 4, but got rank ${r.rank}.`),y(t.length===2,()=>`Error in resizeNearestNeighbor: new shape must 2D, but got shape ${t}.`),y(r.dtype==="float32"||r.dtype==="int32",()=>"`images` must have `int32` or `float32` as dtype"),y(s===!1||n===!1,()=>"Error in resizeNearestNeighbor: If halfPixelCenters is true, alignCorners must be false.");let a=r,o=!1;r.rank===3&&(o=!0,a=v(r,[1,r.shape[0],r.shape[1],r.shape[2]]));const i={images:a},u={alignCorners:n,halfPixelCenters:s,size:t},c=N.runKernel(Au,i,u);return o?v(c,[c.shape[1],c.shape[2],c.shape[3]]):c}const Hy=b({resizeNearestNeighbor_:Ky});/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Gy(e,t="binary",n=!1,s=.5){const r=m(e,"image","threshold"),a=.2989,o=.587,i=.114,u=r.shape[0]*r.shape[1];let c=z($t([s]),255),h,p,f,d;if(y(r.rank===3,()=>`Error in threshold: image must be rank 3,but got rank ${r.rank}.`),y(r.shape[2]===3||r.shape[2]===1,()=>`Error in threshold: image color channel must be equal to 3 or 1but got ${r.shape[2]}.`),y(r.dtype==="int32"||r.dtype==="float32",()=>`Error in dtype: image dtype must be int32 or float32,but got dtype ${r.dtype}.`),y(t==="otsu"||t==="binary",()=>`Method must be binary or otsu, but was ${t}`),r.shape[2]===3){[h,p,f]=Ce(r,[1,1,1],-1);const S=z(h,a),$=z(p,o),O=z(f,i);d=rt(rt(S,$),O)}else d=e;if(t==="otsu"){const S=Ta(st(Ka(d),"int32"),xt([]),256);c=My(S,u)}const w=n?As(d,c):En(d,c);return st(z(w,255),"int32")}function My(e,t){let n=$t([-1]),s=$t([0]),r=$t([0]),a,o,i,u,c,h;for(let p=0;p<e.size-1;p++){a=K(e,0,p+1),o=K(e,p+1),c=lt(H(a),t),h=lt(H(o),t);const f=H(z(a,Fe(0,a.size)));i=lt(f,H(a));const d=Nn(o.shape,a.size),w=rt(Fe(0,o.size),d),T=z(o,w);u=lt(H(T),H(o));const S=V(i,u),$=V(i,u),O=z(c,h);r=z(z(O,S),$);const I=En(r,s);s=be(I,r,s),n=be(I,$t([p]),n)}return n}const Xy=b({threshold_:Gy});/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Yy(e,t,n="nearest",s="constant",r=0,a){const o=m(e,"image","transform","float32"),i=m(t,"transforms","transform","float32");y(o.rank===4,()=>`Error in transform: image must be rank 4,but got rank ${o.rank}.`),y(i.rank===2&&(i.shape[0]===o.shape[0]||i.shape[0]===1)&&i.shape[1]===8,()=>"Error in transform: Input transform should be batch x 8 or 1 x 8"),y(a==null||a.length===2,()=>`Error in transform: outputShape must be [height, width] or null, but got ${a}.`);const u={image:o,transforms:i},c={interpolation:n,fillMode:s,fillValue:r,outputShape:a};return N.runKernel(pc,u,c)}const Jy=b({transform_:Yy});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Zy(e,t,n){y(t%1===0,()=>`bandPart(): numLower must be an integer, got ${t}.`),y(n%1===0,()=>`bandPart(): numUpper must be an integer, got ${n}.`);const s=m(e,"a","bandPart");y(s.rank>=2,()=>`bandPart(): Rank must be at least 2, got ${s.rank}.`);const r=s.shape,[a,o]=s.shape.slice(-2);if(!(t<=a))throw new Error(`bandPart(): numLower (${t}) must not be greater than the number of rows (${a}).`);if(!(n<=o))throw new Error(`bandPart(): numUpper (${n}) must not be greater than the number of columns (${o}).`);t<0&&(t=a),n<0&&(n=o);const i=v(Fe(0,a,1,"int32"),[-1,1]),u=Fe(0,o,1,"int32"),c=V(i,u),h=un(As(c,U(+t,"int32")),Aa(c,U(-n,"int32"))),p=we([a,o],s.dtype);return v(Bt(ue(v(s,[-1,a,o])).map(f=>be(h,f,p))),r)}const Qy=b({bandPart_:Zy});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function tb(e){let t;if(Array.isArray(e)){t=!1,y(e!=null&&e.length>0,()=>"Gram-Schmidt process: input must not be null, undefined, or empty");const r=e[0].shape[0];for(let a=1;a<e.length;++a)y(e[a].shape[0]===r,()=>`Gram-Schmidt: Non-unique lengths found in the input vectors: (${e[a].shape[0]} vs. ${r})`)}else t=!0,e=Ce(e,e.shape[0],0).map(r=>Ls(r,[0]));y(e.length<=e[0].shape[0],()=>`Gram-Schmidt: Number of vectors (${e.length}) exceeds number of dimensions (${e[0].shape[0]}).`);const n=[],s=e;for(let r=0;r<e.length;++r)n.push(N.tidy(()=>{let a=s[r];if(r>0)for(let o=0;o<r;++o){const i=z(H(z(n[o],a)),n[o]);a=V(a,i)}return lt(a,kn(a,"euclidean"))}));return t?Bt(n,0):n}const eb=b({gramSchmidt_:tb});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function nb(e,t=!1){if(y(e.rank>=2,()=>`qr() requires input tensor to have a rank >= 2, but got rank ${e.rank}`),e.rank===2)return gr(e,t);{const n=e.shape.slice(0,e.shape.length-2).reduce((u,c)=>u*c),s=ue(v(e,[n,e.shape[e.shape.length-2],e.shape[e.shape.length-1]]),0),r=[],a=[];s.forEach(u=>{const[c,h]=gr(u,t);r.push(c),a.push(h)});const o=v(Bt(r,0),e.shape),i=v(Bt(a,0),e.shape);return[o,i]}}function gr(e,t=!1){return N.tidy(()=>{y(e.shape.length===2,()=>`qr2d() requires a 2D Tensor, but got a ${e.shape.length}D Tensor.`);const n=e.shape[0],s=e.shape[1];let r=_a(n),a=Vt(e);const o=_e([[1]],[1,1]);let i=Vt(o);const u=n>=s?s:n;for(let c=0;c<u;++c){const h=a,p=i,f=r;[i,a,r]=N.tidy(()=>{const d=K(a,[c,c],[n-c,1]),w=kn(d),T=K(a,[c,c],[1,1]),S=be(En(T,0),_e([[-1]]),_e([[1]])),$=V(T,z(S,w)),O=lt(d,$);O.shape[0]===1?i=Vt(o):i=pt([o,K(O,[1,0],[O.shape[0]-1,O.shape[1]])],0);const I=Dt(lt(W(S,$),w)),_=K(a,[c,0],[n-c,s]),A=z(I,i),D=Zn(i);if(c===0)a=V(_,W(A,W(D,_)));else{const E=V(_,W(A,W(D,_)));a=pt([K(a,[0,0],[c,s]),E],0)}const B=Zn(A),F=K(r,[0,c],[n,r.shape[1]-c]);if(c===0)r=V(F,W(W(F,i),B));else{const E=V(F,W(W(F,i),B));r=pt([K(r,[0,0],[n,c]),E],1)}return[i,a,r]}),Ml([h,p,f])}return!t&&n>s&&(r=K(r,[0,0],[n,s]),a=K(a,[0,0],[s,s])),[r,a]})}const sb=b({qr_:nb});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */var ft;(function(e){e[e.NONE=0]="NONE",e[e.MEAN=1]="MEAN",e[e.SUM=2]="SUM",e[e.SUM_BY_NONZERO_WEIGHTS=3]="SUM_BY_NONZERO_WEIGHTS"})(ft||(ft={}));function rb(e,t,n=ft.SUM_BY_NONZERO_WEIGHTS){const s=m(e,"losses","computeWeightedLoss");let r=null;t!=null&&(r=m(t,"weights","computeWeightedLoss"));const a=r==null?s:z(s,r);if(n===ft.NONE)return a;if(n===ft.SUM)return H(a);if(n===ft.MEAN){if(r==null)return cn(a);{const o=s.size/r.size,i=lt(H(a),H(r));return o>1?lt(i,U(o)):i}}if(n===ft.SUM_BY_NONZERO_WEIGHTS){if(r==null)return lt(H(a),U(s.size));{const o=z(r,Jt(s.shape)),i=st(H(za(o,U(0))),"float32");return lt(H(a),i)}}throw Error(`Unknown reduction: ${n}`)}const Lt=b({computeWeightedLoss_:rb});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function ab(e,t,n,s=ft.SUM_BY_NONZERO_WEIGHTS){const r=m(e,"labels","absoluteDifference"),a=m(t,"predictions","absoluteDifference");let o=null;n!=null&&(o=m(n,"weights","absoluteDifference")),ht(r.shape,a.shape,"Error in absoluteDifference: ");const i=Nt(V(r,a));return Lt(i,o,s)}const ob=b({absoluteDifference_:ab});function ib(e,t,n,s,r=ft.SUM_BY_NONZERO_WEIGHTS){const a=m(e,"labels","cosineDistance"),o=m(t,"predictions","cosineDistance");let i=null;s!=null&&(i=m(s,"weights","cosineDistance")),ht(a.shape,o.shape,"Error in cosineDistance: ");const u=U(1),c=V(u,H(z(a,o),n,!0));return Lt(c,i,r)}const ub=b({cosineDistance_:ib});function cb(e,t,n,s=ft.SUM_BY_NONZERO_WEIGHTS){let r=m(e,"labels","hingeLoss");const a=m(t,"predictions","hingeLoss");let o=null;n!=null&&(o=m(n,"weights","hingeLoss")),ht(r.shape,a.shape,"Error in hingeLoss: ");const i=U(1);r=V(z(U(2),r),i);const u=_n(V(i,z(r,a)));return Lt(u,o,s)}const lb=b({hingeLoss_:cb});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function pb(e,t,n,s=1,r=ft.SUM_BY_NONZERO_WEIGHTS){const a=m(e,"labels","huberLoss"),o=m(t,"predictions","huberLoss");let i=null;n!=null&&(i=m(n,"weights","huberLoss")),ht(a.shape,o.shape,"Error in huberLoss: ");const u=U(s),c=Nt(V(o,a)),h=Ra(c,u),p=V(c,h),f=rt(z(U(.5),$n(h)),z(u,p));return Lt(f,i,r)}const hb=b({huberLoss_:pb});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function fb(e,t,n,s=1e-7,r=ft.SUM_BY_NONZERO_WEIGHTS){const a=m(e,"labels","logLoss"),o=m(t,"predictions","logLoss");let i=null;n!=null&&(i=m(n,"weights","logLoss")),ht(a.shape,o.shape,"Error in logLoss: ");const u=U(1),c=U(s),h=Dt(z(a,Oe(rt(o,c)))),p=z(V(u,a),Oe(rt(V(u,o),c))),f=V(h,p);return Lt(f,i,r)}const mb=b({logLoss_:fb});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function db(e,t,n,s=ft.SUM_BY_NONZERO_WEIGHTS){const r=m(e,"labels","meanSquaredError"),a=m(t,"predictions","meanSquaredError");let o=null;n!=null&&(o=m(n,"weights","meanSquaredError")),ht(r.shape,a.shape,"Error in meanSquaredError: ");const i=Ga(r,a);return Lt(i,o,s)}const gb=b({meanSquaredError_:db});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function yb(e,t){const n=m(e,"labels","sigmoidCrossEntropyWithLogits"),s=m(t,"logits","sigmoidCrossEntropyWithLogits");ht(n.shape,s.shape,"Error in sigmoidCrossEntropyWithLogits: ");const r=_n(s),a=z(s,n),o=Oa(re(Dt(Nt(s))));return rt(V(r,a),o)}function bb(e,t,n,s=0,r=ft.SUM_BY_NONZERO_WEIGHTS){let a=m(e,"multiClassLabels","sigmoidCrossEntropy");const o=m(t,"logits","sigmoidCrossEntropy");let i=null;if(n!=null&&(i=m(n,"weights","sigmoidCrossEntropy")),ht(a.shape,o.shape,"Error in sigmoidCrossEntropy: "),s>0){const c=U(s),h=U(1),p=U(.5);a=rt(z(a,V(h,c)),z(p,c))}const u=yb(a,o);return Lt(u,i,r)}const wb=b({sigmoidCrossEntropy_:bb});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Nb(e,t,n=-1){if(n===-1&&(n=t.rank-1),n!==t.rank-1)throw Error(`Softmax cross entropy along a non-last dimension is not yet supported. Labels / logits was rank ${t.rank} and dim was ${n}`);return Ct((r,a,o)=>{const u=Ca(a,[n],!0),c=V(st(a,"float32"),u);o([r,c]);const h=Dt(z(c,r));return{value:H(h,[n]),gradFunc:(d,w)=>{const[T,S]=w,$=Sn(d.shape,[n]);return[z(v(d,$),V(st(T,"float32"),re(S))),z(v(d,$),V(re(S),st(T,"float32")))]}}})(e,t)}function Tb(e,t,n,s=0,r=ft.SUM_BY_NONZERO_WEIGHTS){let a=m(e,"onehotLabels","softmaxCrossEntropy");const o=m(t,"logits","softmaxCrossEntropy");let i=null;if(n!=null&&(i=m(n,"weights","softmaxCrossEntropy")),ht(a.shape,o.shape,"Error in softmaxCrossEntropy: "),s>0){const c=U(s),h=U(1),p=U(a.shape[1]);a=rt(z(a,V(h,c)),lt(c,p))}const u=Nb(a,o);return Lt(u,i,r)}const Sb=b({softmaxCrossEntropy_:Tb});/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function $b(e,t,n,s){const r=m(e,"indices","sparseFillEmptyRows","int32"),a=m(t,"values","sparseFillEmptyRows"),o=m(n,"denseShape","sparseFillEmptyRows","int32"),i=m(s,"defaultValue","sparseFillEmptyRows",a.dtype);if(r.rank!==2)throw new Error(`Indices should be Tensor2D but received shape
        ${r.shape}`);if(a.rank!==1)throw new Error(`Values should be Tensor1D but received shape ${a.shape}`);if(o.rank!==1)throw new Error(`Dense shape should be Tensor1D but received shape ${o.shape}`);if(i.rank!==0)throw new Error(`Default value should be a scalar but received shape ${i.shape}`);const u={indices:r,values:a,denseShape:o,defaultValue:i},c=N.runKernel(Ju,u);return{outputIndices:c[0],outputValues:c[1],emptyRowIndicator:c[2],reverseIndexMap:c[3]}}const kb=b({sparseFillEmptyRows_:$b});/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Eb(e,t,n){const s=m(e,"inputIndices","sparseReshape","int32"),r=m(t,"inputShape","sparseReshape","int32"),a=m(n,"newShape","sparseReshape","int32");if(s.rank!==2)throw new Error(`Input indices should be Tensor2D but received shape
        ${s.shape}`);if(r.rank!==1)throw new Error(`Input shape should be Tensor1D but received shape ${r.shape}`);if(a.rank!==1)throw new Error(`New shape should be Tensor1D but received shape ${a.shape}`);const o={inputIndices:s,inputShape:r,newShape:a},i=N.runKernel(Zu,o);return{outputIndices:i[0],outputShape:i[1]}}const vb=b({sparseReshape_:Eb});/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function _b(e,t,n){const s=m(e,"data","sparseSegmentMean"),r=m(t,"indices","sparseSegmentMean","int32"),a=m(n,"segmentIds","sparseSegmentMean","int32");if(s.rank<1)throw new Error("Data should be at least 1 dimensional but received scalar");if(r.rank!==1)throw new Error(`Indices should be Tensor1D but received shape
          ${r.shape}`);if(a.rank!==1)throw new Error(`Segment ids should be Tensor1D but received shape
          ${a.shape}`);const o={data:s,indices:r,segmentIds:a};return N.runKernel(Qu,o)}const xb=b({sparseSegmentMean_:_b});/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Ib(e,t,n){const s=m(e,"data","sparseSegmentSum"),r=m(t,"indices","sparseSegmentSum","int32"),a=m(n,"segmentIds","sparseSegmentSum","int32");if(s.rank<1)throw new Error("Data should be at least 1 dimensional but received scalar");if(r.rank!==1)throw new Error(`Indices should be Tensor1D but received shape
         ${r.shape}`);if(a.rank!==1)throw new Error(`Segment ids should be Tensor1D but received shape
         ${a.shape}`);const o={data:s,indices:r,segmentIds:a};return N.runKernel(tc,o)}const Ab=b({sparseSegmentSum_:Ib});/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Db(e,t,n,s,r,a,o,i){const u=m(e,"data","stringNGrams","string");if(u.dtype!=="string")throw new Error("Data must be of datatype string");if(u.shape.length!==1)throw new Error(`Data must be a vector, saw: ${u.shape}`);const c=m(t,"dataSplits","stringNGrams");if(c.dtype!=="int32")throw new Error("Data splits must be of datatype int32");const h={separator:n,nGramWidths:s,leftPad:r,rightPad:a,padWidth:o,preserveShortSequences:i},p={data:u,dataSplits:c},f=N.runKernel(rc,p,h);return{nGrams:f[0],nGramsSplits:f[1]}}const Ob=b({stringNGrams_:Db});/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Fb(e,t,n=!0){const s=m(e,"input","stringSplit","string"),r=m(t,"delimiter","stringSplit","string");if(s.rank!==1)throw new Error(`Input should be Tensor1D but received shape ${s.shape}`);if(r.rank!==0)throw new Error(`Delimiter should be a scalar but received shape ${r.shape}`);const a={skipEmpty:n},o={input:s,delimiter:r},i=N.runKernel(ac,o,a);return{indices:i[0],values:i[1],shape:i[2]}}const Cb=b({stringSplit_:Fb});/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Bb(e,t){const n=m(e,"input","stringToHashBucketFast","string"),s={numBuckets:t};if(t<=0)throw new Error("Number of buckets must be at least 1");const r={input:n};return N.runKernel(oc,r,s)}const Lb=b({stringToHashBucketFast_:Bb});/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */const Pb={fft:Cs,ifft:ln,rfft:Bs,irfft:Ha},Rb={hammingWindow:cy,hannWindow:Ja,frame:Za,stft:fy},zb={flipLeftRight:yy,grayscaleToRGB:wy,resizeNearestNeighbor:Hy,resizeBilinear:jy,rotateWithOffset:Ty,cropAndResize:dy,nonMaxSuppression:$y,nonMaxSuppressionAsync:Cy,nonMaxSuppressionWithScore:Ly,nonMaxSuppressionWithScoreAsync:Ry,nonMaxSuppressionPadded:Vy,nonMaxSuppressionPaddedAsync:Uy,threshold:Xy,transform:Jy},Vb={bandPart:Qy,gramSchmidt:eb,qr:sb},qb={absoluteDifference:ob,computeWeightedLoss:Lt,cosineDistance:ub,hingeLoss:lb,huberLoss:hb,logLoss:mb,meanSquaredError:gb,sigmoidCrossEntropy:wb,softmaxCrossEntropy:Sb},Ub={sparseFillEmptyRows:kb,sparseReshape:vb,sparseSegmentMean:xb,sparseSegmentSum:Ab},Wb={stringNGrams:Ob,stringSplit:Cb,stringToHashBucketFast:Lb};/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */const jb=R();jb.registerFlag("KEEP_INTERMEDIATE_TENSORS",()=>!1,e=>{e&&console.warn("Keep intermediate tensors is ON. This will print the values of all intermediate tensors during model inference. Not all models support this mode. For details, check e2e/benchmarks/ model_config.js. This significantly impacts performance.")});/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * =============================================================================
 */var wt;(function(e){e[e.DT_INVALID=0]="DT_INVALID",e[e.DT_FLOAT=1]="DT_FLOAT",e[e.DT_DOUBLE=2]="DT_DOUBLE",e[e.DT_INT32=3]="DT_INT32",e[e.DT_UINT8=4]="DT_UINT8",e[e.DT_INT16=5]="DT_INT16",e[e.DT_INT8=6]="DT_INT8",e[e.DT_STRING=7]="DT_STRING",e[e.DT_COMPLEX64=8]="DT_COMPLEX64",e[e.DT_INT64=9]="DT_INT64",e[e.DT_BOOL=10]="DT_BOOL",e[e.DT_QINT8=11]="DT_QINT8",e[e.DT_QUINT8=12]="DT_QUINT8",e[e.DT_QINT32=13]="DT_QINT32",e[e.DT_BFLOAT16=14]="DT_BFLOAT16",e[e.DT_QINT16=15]="DT_QINT16",e[e.DT_QUINT16=16]="DT_QUINT16",e[e.DT_UINT16=17]="DT_UINT16",e[e.DT_COMPLEX128=18]="DT_COMPLEX128",e[e.DT_HALF=19]="DT_HALF",e[e.DT_RESOURCE=20]="DT_RESOURCE",e[e.DT_VARIANT=21]="DT_VARIANT",e[e.DT_UINT32=22]="DT_UINT32",e[e.DT_UINT64=23]="DT_UINT64",e[e.DT_FLOAT_REF=101]="DT_FLOAT_REF",e[e.DT_DOUBLE_REF=102]="DT_DOUBLE_REF",e[e.DT_INT32_REF=103]="DT_INT32_REF",e[e.DT_UINT8_REF=104]="DT_UINT8_REF",e[e.DT_INT16_REF=105]="DT_INT16_REF",e[e.DT_INT8_REF=106]="DT_INT8_REF",e[e.DT_STRING_REF=107]="DT_STRING_REF",e[e.DT_COMPLEX64_REF=108]="DT_COMPLEX64_REF",e[e.DT_INT64_REF=109]="DT_INT64_REF",e[e.DT_BOOL_REF=110]="DT_BOOL_REF",e[e.DT_QINT8_REF=111]="DT_QINT8_REF",e[e.DT_QUINT8_REF=112]="DT_QUINT8_REF",e[e.DT_QINT32_REF=113]="DT_QINT32_REF",e[e.DT_BFLOAT16_REF=114]="DT_BFLOAT16_REF",e[e.DT_QINT16_REF=115]="DT_QINT16_REF",e[e.DT_QUINT16_REF=116]="DT_QUINT16_REF",e[e.DT_UINT16_REF=117]="DT_UINT16_REF",e[e.DT_COMPLEX128_REF=118]="DT_COMPLEX128_REF",e[e.DT_HALF_REF=119]="DT_HALF_REF",e[e.DT_RESOURCE_REF=120]="DT_RESOURCE_REF",e[e.DT_VARIANT_REF=121]="DT_VARIANT_REF",e[e.DT_UINT32_REF=122]="DT_UINT32_REF",e[e.DT_UINT64_REF=123]="DT_UINT64_REF"})(wt||(wt={}));var yr;(function(e){(function(t){t[t.LEGACY=0]="LEGACY",t[t.V1=1]="V1",t[t.V2=2]="V2"})(e.CheckpointFormatVersion||(e.CheckpointFormatVersion={}))})(yr||(yr={}));/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */const Ws={};function T1(e,t){const n={tfOpName:e,category:"custom",inputs:[],attrs:[],customExecutor:t};Ws[e]=n}function Qa(e){return Ws[e]}function S1(e){delete Ws[e]}/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function l(e,t,n,s,r){const a=t.inputParams[e];if(a&&a.inputIndexStart!==void 0){const i=a.inputIndexStart,u=a.inputIndexEnd===0?void 0:a.inputIndexEnd===void 0?i+1:a.inputIndexEnd;if(a.type==="tensor")return ct(t.inputNames[a.inputIndexStart],n,s,r);if(a.type==="tensors")return t.inputNames.slice(i,u).map(f=>ct(f,n,s,r));const c=ct(t.inputNames.slice(i)[0],n,s,r),h=c.dataSync();return a.type==="number"?h[0]:Zt(c.shape,h)}const o=t.attrParams[e];return o&&o.value}function ct(e,t,n,s){const[r,a]=mt(e);if(s!=null){const i=s.getHashTableHandleByName(r);if(i!=null)return i}const o=n.currentContextIds.find(i=>!!t[pn(r,i)]);return o!==void 0?t[pn(r,o)][a]:void 0}function Kb(e,t,n){return t[pn(e,n.currentContextId)]}function _t(e,t){const[n,s,r]=mt(e);return[pn(n,t&&t.currentContextId),s,r]}function pn(e,t){return t?`${e}-${t}`:e}function mt(e){const t=e.split(":");if(t.length===1)return[e,0,void 0];const n=t[0],s=t.length===3?t[1]:void 0,r=Number(t[t.length-1]);return[n,r,s]}function tn(e,t,n){let s=l("pad",e,t,n);if(s==="explicit"){s=l("explicitPaddings",e,t,n);const r=[[0,0],[0,0],[0,0],[0,0]];for(let a=0;a<4;a++)r[a][0]=s[a*2],r[a][1]=s[a*2+1];return r}return s}function It(e){return e.kept?e:Vt(e)}/**
 * @license
 * Copyright 2022 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */const Hb=[{tfOpName:"Add",category:"arithmetic",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"AddV2",category:"arithmetic",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"AddN",category:"arithmetic",inputs:[{start:0,end:0,name:"tensors",type:"tensors"}]},{tfOpName:"BiasAdd",category:"arithmetic",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0},{tfName:"data_format",name:"dataFormat",type:"string",notSupported:!0}]},{tfOpName:"Sub",category:"arithmetic",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"RealDiv",category:"arithmetic",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Div",category:"arithmetic",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"DivNoNan",category:"arithmetic",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"FloorDiv",category:"arithmetic",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Mul",category:"arithmetic",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Maximum",category:"arithmetic",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Minimum",category:"arithmetic",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Pow",category:"arithmetic",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"SquaredDifference",category:"arithmetic",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Mod",category:"arithmetic",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"FloorMod",category:"arithmetic",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]}];var Gb=Object.freeze({__proto__:null,json:Hb});/**
 * @license
 * Copyright 2022 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */const Mb=[{tfOpName:"Abs",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Acos",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Asin",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Atan",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Atan2",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"y",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Ceil",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"ClipByValue",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"clipValueMin",type:"number"},{start:2,name:"clipValueMax",type:"number"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Complex",category:"basic_math",inputs:[{start:0,name:"real",type:"tensor"},{start:1,name:"imag",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"ComplexAbs",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Cos",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Cosh",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Elu",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Exp",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Floor",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Log",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Imag",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0},{tfName:"Tout",name:"outputType",type:"dtype",notSupported:!0}]},{tfOpName:"Neg",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Real",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0},{tfName:"Tout",name:"outputType",type:"dtype",notSupported:!0}]},{tfOpName:"Prelu",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"alpha",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Relu",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Relu6",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Selu",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Sigmoid",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Sin",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Sinh",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Sqrt",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Rsqrt",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Square",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Tan",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Tanh",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Sign",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Round",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Expm1",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Log1p",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Reciprocal",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Softplus",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Asinh",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Acosh",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Atanh",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Erf",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Prod",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"axes",type:"number[]"}],attrs:[{tfName:"keep_dims",name:"keepDims",type:"bool",notSupported:!0},{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"LeakyRelu",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"alpha",name:"alpha",type:"number",defaultValue:.2},{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"IsNan",category:"basic_math",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]}];var Xb=Object.freeze({__proto__:null,json:Mb});/**
 * @license
 * Copyright 2022 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */const Yb=[{tfOpName:"EmptyTensorList",category:"control",inputs:[{start:0,name:"elementShape",type:"shape"},{start:1,name:"maxNumElements",type:"number"}],attrs:[{tfName:"element_dtype",name:"elementDType",type:"dtype"}]},{tfOpName:"LoopCond",category:"control",inputs:[{start:0,name:"pred",type:"tensor"}]},{tfOpName:"Switch",category:"control",inputs:[{start:0,name:"data",type:"tensor"},{start:1,name:"pred",type:"tensor"}]},{tfOpName:"Merge",category:"control",inputs:[{start:0,end:0,name:"tensors",type:"tensors"}]},{tfOpName:"Enter",category:"control",inputs:[{start:0,name:"tensor",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0},{tfName:"frame_name",name:"frameName",type:"string"},{tfName:"is_constant",name:"isConstant",type:"bool"}]},{tfOpName:"Exit",category:"control",inputs:[{start:0,name:"tensor",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"NextIteration",category:"control",inputs:[{start:0,name:"tensor",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"TensorArrayV3",category:"control",inputs:[{start:0,name:"size",type:"number"}],attrs:[{tfName:"dtype",name:"dtype",type:"dtype"},{tfName:"element_shape",name:"elementShape",type:"shape"},{tfName:"dynamic_size",name:"dynamicSize",type:"bool"},{tfName:"clear_after_read",name:"clearAfterRead",type:"bool"},{tfName:"identical_element_shapes",name:"identicalElementShapes",type:"bool"},{tfName:"tensor_array_name",name:"name",type:"string"}]},{tfOpName:"TensorArrayWriteV3",category:"control",inputs:[{start:0,name:"tensorArrayId",type:"tensor"},{start:1,name:"index",type:"number"},{start:2,name:"tensor",type:"tensor"},{start:3,name:"flowIn",type:"number"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"TensorArrayReadV3",category:"control",inputs:[{start:0,name:"tensorArrayId",type:"tensor"},{start:1,name:"index",type:"number"},{start:2,name:"flowIn",type:"number"}],attrs:[{tfName:"dtype",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"TensorArrayGatherV3",category:"control",inputs:[{start:0,name:"tensorArrayId",type:"tensor"},{start:1,name:"indices",type:"number[]"},{start:2,name:"flowIn",type:"number"}],attrs:[{tfName:"dtype",name:"dtype",type:"dtype"},{tfName:"element_shape",name:"elementShape",type:"shape"}]},{tfOpName:"TensorArrayScatterV3",category:"control",inputs:[{start:0,name:"tensorArrayId",type:"tensor"},{start:1,name:"indices",type:"number[]"},{start:2,name:"tensor",type:"tensor"},{start:3,name:"flowIn",type:"number"}],attrs:[{tfName:"T",name:"dtype",type:"dtype"}]},{tfOpName:"TensorArrayConcatV3",category:"control",inputs:[{start:0,name:"tensorArrayId",type:"tensor"},{start:1,name:"flowIn",type:"number"}],attrs:[{tfName:"dtype",name:"dtype",type:"dtype"},{tfName:"element_shape_except0",name:"elementShapeExcept0",type:"shape",notSupported:!0}]},{tfOpName:"TensorArraySplitV3",category:"control",inputs:[{start:0,name:"tensorArrayId",type:"tensor"},{start:1,name:"tensor",type:"tensor"},{start:2,name:"lengths",type:"number[]"},{start:3,name:"flowIn",type:"number"}],attrs:[{tfName:"T",name:"dtype",type:"dtype"}]},{tfOpName:"TensorArraySizeV3",category:"control",inputs:[{start:0,name:"tensorArrayId",type:"tensor"},{start:1,name:"flowIn",type:"number"}]},{tfOpName:"TensorArrayCloseV3",category:"control",inputs:[{start:0,name:"tensorArrayId",type:"tensor"}]},{tfOpName:"StatelessIf",category:"control",inputs:[{start:0,name:"cond",type:"tensor"},{start:1,end:0,name:"args",type:"tensors"}],attrs:[{tfName:"then_branch",name:"thenBranch",type:"func"},{tfName:"else_branch",name:"elseBranch",type:"func"}]},{tfOpName:"If",category:"control",inputs:[{start:0,name:"cond",type:"tensor"},{start:1,end:0,name:"args",type:"tensors"}],attrs:[{tfName:"then_branch",name:"thenBranch",type:"func"},{tfName:"else_branch",name:"elseBranch",type:"func"}]},{tfOpName:"StatelessWhile",category:"control",inputs:[{start:0,end:0,name:"args",type:"tensors"}],attrs:[{tfName:"cond",name:"cond",type:"func"},{tfName:"body",name:"body",type:"func"}]},{tfOpName:"While",category:"control",inputs:[{start:0,end:0,name:"args",type:"tensors"}],attrs:[{tfName:"cond",name:"cond",type:"func"},{tfName:"body",name:"body",type:"func"}]},{tfOpName:"TensorListScatter",category:"control",inputs:[{start:0,name:"tensor",type:"tensor"},{start:1,name:"indices",type:"number[]"},{start:2,name:"elementShape",type:"shape"}],attrs:[{tfName:"element_dtype",name:"elementDType",type:"dtype"}]},{tfOpName:"TensorListScatterV2",category:"control",inputs:[{start:0,name:"tensor",type:"tensor"},{start:1,name:"indices",type:"number[]"},{start:2,name:"elementShape",type:"shape"},{start:3,name:"numElements",type:"number"}],attrs:[{tfName:"element_dtype",name:"elementDType",type:"dtype"}]},{tfOpName:"TensorListGather",category:"control",inputs:[{start:0,name:"tensorListId",type:"tensor"},{start:1,name:"indices",type:"number[]"},{start:2,name:"elementShape",type:"shape"}],attrs:[{tfName:"element_dtype",name:"elementDType",type:"dtype"}]},{tfOpName:"TensorListGetItem",category:"control",inputs:[{start:0,name:"tensorListId",type:"tensor"},{start:1,name:"index",type:"number"},{start:2,name:"elementShape",type:"shape"}],attrs:[{tfName:"element_dtype",name:"elementDType",type:"dtype"}]},{tfOpName:"TensorListSetItem",category:"control",inputs:[{start:0,name:"tensorListId",type:"tensor"},{start:1,name:"index",type:"number"},{start:2,name:"tensor",type:"tensor"}],attrs:[{tfName:"element_dtype",name:"elementDType",type:"dtype"}]},{tfOpName:"TensorListReserve",category:"control",inputs:[{start:0,name:"elementShape",type:"shape"},{start:1,name:"numElements",type:"number"}],attrs:[{tfName:"element_dtype",name:"elementDType",type:"dtype"}]},{tfOpName:"TensorListFromTensor",category:"control",inputs:[{start:0,name:"tensor",type:"tensor"},{start:1,name:"elementShape",type:"shape"}],attrs:[{tfName:"element_dtype",name:"elementDType",type:"dtype"}]},{tfOpName:"TensorListStack",category:"control",inputs:[{start:0,name:"tensorListId",type:"tensor"},{start:1,name:"elementShape",type:"shape"}],attrs:[{tfName:"element_dtype",name:"elementDType",type:"dtype"},{tfName:"num_elements",name:"numElements",type:"dtype"}]},{tfOpName:"TensorListSplit",category:"control",inputs:[{start:0,name:"tensor",type:"tensor"},{start:1,name:"elementShape",type:"shape"},{start:2,name:"lengths",type:"number[]"}],attrs:[{tfName:"element_dtype",name:"elementDType",type:"dtype"}]},{tfOpName:"TensorListConcat",category:"control",inputs:[{start:0,name:"tensorListId",type:"tensor"}],attrs:[{tfName:"element_shape",name:"elementShape",type:"shape"},{tfName:"element_dtype",name:"elementDType",type:"dtype"}]},{tfOpName:"TensorListConcatV2",category:"control",inputs:[{start:0,name:"tensorListId",type:"tensor"}],attrs:[{tfName:"element_shape",name:"elementShape",type:"shape"},{tfName:"element_dtype",name:"elementDType",type:"dtype"}]},{tfOpName:"TensorListPopBack",category:"control",inputs:[{start:0,name:"tensorListId",type:"tensor"},{start:1,name:"elementShape",type:"shape"}],attrs:[{tfName:"element_dtype",name:"elementDType",type:"dtype"}]},{tfOpName:"TensorListPushBack",category:"control",inputs:[{start:0,name:"tensorListId",type:"tensor"},{start:1,name:"tensor",type:"tensor"}],attrs:[{tfName:"element_dtype",name:"elementDType",type:"dtype"}]},{tfOpName:"TensorListLength",category:"control",inputs:[{start:0,name:"tensorListId",type:"tensor"}]},{tfOpName:"TensorListResize",category:"control",inputs:[{start:0,name:"tensorListId",type:"tensor"},{start:1,name:"size",type:"number"}]}];var Jb=Object.freeze({__proto__:null,json:Yb});/**
 * @license
 * Copyright 2022 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */const Zb=[{tfOpName:"AvgPool",category:"convolution",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"strides",name:"strides",type:"number[]"},{tfName:"padding",name:"pad",type:"string"},{tfName:"data_format",name:"dataFormat",type:"string",notSupported:!0},{tfName:"ksize",name:"kernelSize",type:"number[]"},{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"MaxPool",category:"convolution",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"strides",name:"strides",type:"number[]"},{tfName:"padding",name:"pad",type:"string"},{tfName:"data_format",name:"dataFormat",type:"string",notSupported:!0},{tfName:"ksize",name:"kernelSize",type:"number[]"},{tfName:"explicit_paddings",name:"explicitPaddings",type:"number[]",defaultValue:[],notSupported:!0},{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"MaxPoolWithArgmax",category:"convolution",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"strides",name:"strides",type:"number[]"},{tfName:"padding",name:"pad",type:"string"},{tfName:"ksize",name:"kernelSize",type:"number[]"},{tfName:"include_batch_in_index",name:"includeBatchInIndex",type:"bool"},{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"AvgPool3D",category:"convolution",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"strides",name:"strides",type:"number[]"},{tfName:"padding",name:"pad",type:"string"},{tfName:"data_format",name:"dataFormat",type:"string",notSupported:!0},{tfName:"ksize",name:"kernelSize",type:"number[]"},{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"MaxPool3D",category:"convolution",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"strides",name:"strides",type:"number[]"},{tfName:"padding",name:"pad",type:"string"},{tfName:"data_format",name:"dataFormat",type:"string",notSupported:!0},{tfName:"ksize",name:"kernelSize",type:"number[]"},{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Conv1D",category:"convolution",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"filter",type:"tensor"}],attrs:[{tfName:"stride",name:"stride",type:"number"},{tfName:"padding",name:"pad",type:"string"},{tfName:"data_format",name:"dataFormat",type:"string",defaultValue:"NWC"},{tfName:"T",name:"dtype",type:"dtype",notSupported:!0},{tfName:"dilation",name:"dilation",type:"number",defaultValue:1}]},{tfOpName:"Conv2D",category:"convolution",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"filter",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0},{tfName:"strides",name:"strides",type:"number[]"},{tfName:"padding",name:"pad",type:"string"},{tfName:"useCudnnOnGpu",name:"useCudnnOnGpu",type:"bool"},{tfName:"data_format",name:"dataFormat",type:"string",defaultValue:"NHWC"},{tfName:"explicit_paddings",name:"explicitPaddings",type:"number[]",defaultValue:[]},{tfName:"dilations",name:"dilations",type:"number[]"}]},{tfOpName:"_FusedConv2D",category:"convolution",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"filter",type:"tensor"},{start:2,end:0,name:"args",type:"tensors"}],attrs:[{tfName:"num_args",name:"numArgs",type:"number"},{tfName:"T",name:"dtype",type:"dtype",notSupported:!0},{tfName:"strides",name:"strides",type:"number[]"},{tfName:"padding",name:"pad",type:"string"},{tfName:"explicit_paddings",name:"explicitPaddings",type:"number[]",defaultValue:[]},{tfName:"use_cudnn_on_gpu",name:"useCudnnOnGpu",type:"bool",defaultValue:!0},{tfName:"data_format",name:"dataFormat",type:"string",defaultValue:"NHWC"},{tfName:"dilations",name:"dilations",type:"number[]",defaultValue:[1,1,1,1]},{tfName:"fused_ops",name:"fusedOps",type:"string[]",defaultValue:[]},{tfName:"epsilon",name:"epsilon",type:"number",defaultValue:1e-4},{tfName:"leakyrelu_alpha",name:"leakyreluAlpha",type:"number",defaultValue:.2}]},{tfOpName:"Conv2DBackpropInput",category:"convolution",inputs:[{start:2,name:"x",type:"tensor"},{start:1,name:"filter",type:"tensor"},{start:0,name:"outputShape",type:"number[]"}],attrs:[{tfName:"strides",name:"strides",type:"number[]"},{tfName:"padding",name:"pad",type:"string"},{tfName:"data_format",name:"dataFormat",type:"string",notSupported:!0},{tfName:"explicit_paddings",name:"explicitPaddings",type:"number[]",defaultValue:[]},{tfName:"dilations",name:"dilations",type:"number[]",notSupported:!0}]},{tfOpName:"DepthwiseConv2d",category:"convolution",inputs:[{start:0,name:"input",type:"tensor"},{start:1,name:"filter",type:"tensor"}],attrs:[{tfName:"strides",name:"strides",type:"number[]"},{tfName:"padding",name:"pad",type:"string"},{tfName:"data_format",name:"dataFormat",type:"string",defaultValue:"NHWC"},{tfName:"explicit_paddings",name:"explicitPaddings",type:"number[]",defaultValue:[]},{tfName:"dilations",name:"dilations",type:"number[]"}]},{tfOpName:"DepthwiseConv2dNative",category:"convolution",inputs:[{start:0,name:"input",type:"tensor"},{start:1,name:"filter",type:"tensor"}],attrs:[{tfName:"strides",name:"strides",type:"number[]"},{tfName:"padding",name:"pad",type:"string"},{tfName:"data_format",name:"dataFormat",type:"string",defaultValue:"NHWC"},{tfName:"explicit_paddings",name:"explicitPaddings",type:"number[]",defaultValue:[]},{tfName:"dilations",name:"dilations",type:"number[]"}]},{tfOpName:"FusedDepthwiseConv2dNative",category:"convolution",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"filter",type:"tensor"},{start:2,end:0,name:"args",type:"tensors"}],attrs:[{tfName:"num_args",name:"numArgs",type:"number"},{tfName:"T",name:"dtype",type:"dtype",notSupported:!0},{tfName:"strides",name:"strides",type:"number[]"},{tfName:"padding",name:"pad",type:"string"},{tfName:"data_format",name:"dataFormat",type:"string",defaultValue:"NHWC"},{tfName:"dilations",name:"dilations",type:"number[]",defaultValue:[1,1,1,1]},{tfName:"fused_ops",name:"fusedOps",type:"string[]",defaultValue:[]},{tfName:"explicit_paddings",name:"explicitPaddings",type:"number[]",defaultValue:[]}]},{tfOpName:"Conv3D",category:"convolution",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"filter",type:"tensor"}],attrs:[{tfName:"strides",name:"strides",type:"number[]"},{tfName:"padding",name:"pad",type:"string"},{tfName:"data_format",name:"dataFormat",type:"string",defaultValue:"NHWC"},{tfName:"dilations",name:"dilations",type:"number[]"}]},{tfOpName:"Dilation2D",category:"convolution",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"filter",type:"tensor"}],attrs:[{tfName:"strides",name:"strides",type:"number[]"},{tfName:"rates",name:"dilations",type:"number[]"},{tfName:"padding",name:"pad",type:"string"}]}];var Qb=Object.freeze({__proto__:null,json:Zb});/**
 * @license
 * Copyright 2022 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */const tw=[{tfOpName:"Fill",category:"creation",inputs:[{start:0,name:"shape",type:"number[]"},{start:1,name:"value",type:"number"}],attrs:[{tfName:"T",name:"dtype",type:"dtype"}]},{tfOpName:"LinSpace",category:"creation",inputs:[{start:0,name:"start",type:"number"},{start:1,name:"stop",type:"number"},{start:2,name:"num",type:"number"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"OneHot",category:"creation",inputs:[{start:0,name:"indices",type:"tensor"},{start:1,name:"depth",type:"number"},{start:2,name:"onValue",type:"number",defaultValue:1},{start:3,name:"offValue",type:"number",defaultValue:0}],attrs:[{tfName:"axis",name:"axis",type:"number",notSupported:!0},{tfName:"T",name:"dtype",type:"dtype"}]},{tfOpName:"Ones",category:"creation",inputs:[{start:0,name:"shape",type:"number[]"}],attrs:[{tfName:"T",name:"dtype",type:"dtype"}]},{tfOpName:"OnesLike",category:"creation",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"dtype",name:"dtype",type:"dtype"}]},{tfOpName:"RandomStandardNormal",category:"creation",inputs:[{start:0,name:"shape",type:"number[]"}],attrs:[{tfName:"seed",name:"seed",type:"number",defaultValue:0},{tfName:"seed2",name:"seed2",type:"number",defaultValue:0,notSupported:!0},{tfName:"dtype",name:"dtype",type:"dtype"},{tfName:"T",name:"T",type:"number",notSupported:!0}]},{tfOpName:"RandomUniform",category:"creation",inputs:[{start:0,name:"shape",type:"number[]"}],attrs:[{tfName:"minval",name:"minval",type:"number",defaultValue:0},{tfName:"maxval",name:"maxval",type:"number",defaultValue:1},{tfName:"dtype",name:"dtype",type:"dtype"},{tfName:"seed",name:"seed",type:"number",defaultValue:0},{tfName:"seed2",name:"seed2",type:"number",defaultValue:0,notSupported:!0},{tfName:"T",name:"T",type:"number",notSupported:!0}]},{tfOpName:"Range",category:"creation",inputs:[{start:0,name:"start",type:"number"},{start:1,name:"stop",type:"number"},{start:2,name:"step",type:"number",defaultValue:0}],attrs:[{tfName:"Tidx",name:"dtype",type:"dtype"}]},{tfOpName:"TruncatedNormal",category:"creation",inputs:[{start:0,name:"shape",type:"number[]"}],attrs:[{tfName:"means",name:"mean",type:"number",defaultValue:0},{tfName:"stddev",name:"stdDev",type:"number",defaultValue:1},{tfName:"seed",name:"seed",type:"number"},{tfName:"seed2",name:"seed2",type:"number",defaultValue:0,notSupported:!0},{tfName:"dtype",name:"dtype",type:"dtype"},{tfName:"T",name:"T",type:"number",notSupported:!0}]},{tfOpName:"Zeros",category:"creation",inputs:[{start:0,name:"shape",type:"number[]"}],attrs:[{tfName:"T",name:"dtype",type:"dtype"}]},{tfOpName:"ZerosLike",category:"creation",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype"}]},{tfOpName:"Multinomial",category:"creation",inputs:[{start:0,name:"logits",type:"tensor"},{start:1,name:"numSamples",type:"number"}],attrs:[{tfName:"seed",name:"seed",type:"number"},{tfName:"seed2",name:"seed2",type:"number"},{tfName:"T",name:"dtype",type:"dtype"},{tfName:"output_dtype",name:"output_dtype",type:"dtype"}]}];var ew=Object.freeze({__proto__:null,json:tw});/**
 * @license
 * Copyright 2022 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */const nw=[{tfOpName:"NonMaxSuppressionV2",category:"dynamic",inputs:[{start:0,name:"boxes",type:"tensor"},{start:1,name:"scores",type:"tensor"},{start:2,name:"maxOutputSize",type:"number"},{start:3,name:"iouThreshold",type:"number"}]},{tfOpName:"NonMaxSuppressionV3",category:"dynamic",inputs:[{start:0,name:"boxes",type:"tensor"},{start:1,name:"scores",type:"tensor"},{start:2,name:"maxOutputSize",type:"number"},{start:3,name:"iouThreshold",type:"number"},{start:4,name:"scoreThreshold",type:"number"}]},{tfOpName:"NonMaxSuppressionV4",category:"dynamic",inputs:[{start:0,name:"boxes",type:"tensor"},{start:1,name:"scores",type:"tensor"},{start:2,name:"maxOutputSize",type:"number"},{start:3,name:"iouThreshold",type:"number"},{start:4,name:"scoreThreshold",type:"number"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0},{tfName:"T_threshold",name:"threshold",type:"dtype",notSupported:!0},{tfName:"pad_to_max_output_size",name:"padToMaxOutputSize",type:"bool"}]},{tfOpName:"NonMaxSuppressionV5",category:"dynamic",inputs:[{start:0,name:"boxes",type:"tensor"},{start:1,name:"scores",type:"tensor"},{start:2,name:"maxOutputSize",type:"number"},{start:3,name:"iouThreshold",type:"number"},{start:4,name:"scoreThreshold",type:"number"},{start:5,name:"softNmsSigma",type:"number"}]},{tfOpName:"Where",category:"dynamic",inputs:[{start:0,name:"condition",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"ListDiff",category:"dynamic",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"y",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]}];var sw=Object.freeze({__proto__:null,json:nw});/**
 * @license
 * Copyright 2022 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */const rw=[{tfOpName:"LowerBound",category:"evaluation",inputs:[{start:0,name:"sortedSequence",type:"tensor"},{start:1,name:"values",type:"tensor"}]},{tfOpName:"TopKV2",category:"evaluation",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"k",type:"number"}],attrs:[{tfName:"sorted",name:"sorted",type:"bool"}]},{tfOpName:"UpperBound",category:"evaluation",inputs:[{start:0,name:"sortedSequence",type:"tensor"},{start:1,name:"values",type:"tensor"}]},{tfOpName:"Unique",category:"evaluation",inputs:[{start:0,name:"x",type:"tensor"}]},{tfOpName:"UniqueV2",category:"evaluation",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"axis",type:"number"}]}];var aw=Object.freeze({__proto__:null,json:rw});/**
 * @license
 * Copyright 2022 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */const ow=[{tfOpName:"PlaceholderWithDefault",category:"graph",inputs:[{start:0,name:"default",type:"tensor"}],attrs:[{tfName:"shape",name:"shape",type:"shape"},{tfName:"dtype",name:"dtype",type:"dtype"}]},{tfOpName:"Placeholder",category:"graph",attrs:[{tfName:"shape",name:"shape",type:"shape"},{tfName:"dtype",name:"dtype",type:"dtype"}]},{tfOpName:"Const",category:"graph"},{tfOpName:"Identity",category:"graph",inputs:[{start:0,name:"x",type:"tensor"}]},{tfOpName:"IdentityN",category:"graph",inputs:[{start:0,end:0,name:"x",type:"tensors"}]},{tfOpName:"Snapshot",category:"graph",inputs:[{start:0,name:"x",type:"tensor"}]},{tfOpName:"Rank",category:"graph",inputs:[{start:0,name:"x",type:"tensor"}]},{tfOpName:"Size",category:"graph",inputs:[{start:0,name:"x",type:"tensor"}]},{tfOpName:"Shape",category:"graph",inputs:[{start:0,name:"x",type:"tensor"}]},{tfOpName:"ShapeN",category:"graph",inputs:[{start:0,end:0,name:"x",type:"tensors"}]},{tfOpName:"Print",category:"graph",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"data",type:"tensors"}],attrs:[{tfName:"message",name:"message",type:"string"},{tfName:"first_n",name:"firstN",type:"number",notSupported:!0},{tfName:"summarize",name:"summarize",type:"number",defaultValue:3}]},{tfOpName:"NoOp",category:"graph",inputs:[]},{tfOpName:"StopGradient",category:"graph",inputs:[{start:0,name:"x",type:"tensor"}]},{tfOpName:"FakeQuantWithMinMaxVars",category:"graph",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"min",name:"min",type:"number"},{tfName:"max",name:"max",type:"number"}]}];var iw=Object.freeze({__proto__:null,json:ow});/**
 * @license
 * Copyright 2022 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */const uw=[{tfOpName:"HashTable",category:"hash_table",inputs:[],attrs:[{tfName:"shared_name",name:"sharedName",type:"string"},{tfName:"use_node_name_sharing",name:"useNodeNameSharing",type:"bool"},{tfName:"key_dtype",name:"keyDType",type:"dtype"},{tfName:"value_dtype",name:"valueDType",type:"dtype"}]},{tfOpName:"HashTableV2",category:"hash_table",inputs:[],attrs:[{tfName:"shared_name",name:"sharedName",type:"string"},{tfName:"use_node_name_sharing",name:"useNodeNameSharing",type:"bool"},{tfName:"key_dtype",name:"keyDType",type:"dtype"},{tfName:"value_dtype",name:"valueDType",type:"dtype"}]},{tfOpName:"LookupTableImport",category:"hash_table",inputs:[{start:0,name:"tableHandle",type:"tensor"},{start:1,name:"keys",type:"tensor"},{start:2,name:"values",type:"tensor"}],attrs:[{tfName:"Tin",name:"tIn",type:"dtype",notSupported:!0},{tfName:"Tout",name:"tOut",type:"dtype",notSupported:!0}]},{tfOpName:"LookupTableImportV2",category:"hash_table",inputs:[{start:0,name:"tableHandle",type:"tensor"},{start:1,name:"keys",type:"tensor"},{start:2,name:"values",type:"tensor"}],attrs:[{tfName:"Tin",name:"tIn",type:"dtype",notSupported:!0},{tfName:"Tout",name:"tOut",type:"dtype",notSupported:!0}]},{tfOpName:"LookupTableFind",category:"hash_table",inputs:[{start:0,name:"tableHandle",type:"tensor"},{start:1,name:"keys",type:"tensor"},{start:2,name:"defaultValue",type:"tensor"}],attrs:[{tfName:"Tin",name:"tIn",type:"dtype",notSupported:!0},{tfName:"Tout",name:"tOut",type:"dtype",notSupported:!0}]},{tfOpName:"LookupTableFindV2",category:"hash_table",inputs:[{start:0,name:"tableHandle",type:"tensor"},{start:1,name:"keys",type:"tensor"},{start:2,name:"defaultValue",type:"tensor"}],attrs:[{tfName:"Tin",name:"tIn",type:"dtype",notSupported:!0},{tfName:"Tout",name:"tOut",type:"dtype",notSupported:!0}]},{tfOpName:"LookupTableSize",category:"hash_table",inputs:[{start:0,name:"tableHandle",type:"tensor"}]},{tfOpName:"LookupTableSizeV2",category:"hash_table",inputs:[{start:0,name:"tableHandle",type:"tensor"}]}];var cw=Object.freeze({__proto__:null,json:uw});/**
 * @license
 * Copyright 2022 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */const lw=[{tfOpName:"ResizeBilinear",category:"image",inputs:[{start:0,name:"images",type:"tensor"},{start:1,name:"size",type:"number[]"}],attrs:[{tfName:"align_corners",name:"alignCorners",type:"bool"},{tfName:"half_pixel_centers",name:"halfPixelCenters",type:"bool"},{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"ResizeNearestNeighbor",category:"image",inputs:[{start:0,name:"images",type:"tensor"},{start:1,name:"size",type:"number[]"}],attrs:[{tfName:"align_corners",name:"alignCorners",type:"bool"},{tfName:"half_pixel_centers",name:"halfPixelCenters",type:"bool"},{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"CropAndResize",category:"image",inputs:[{start:0,name:"image",type:"tensor"},{start:1,name:"boxes",type:"tensor"},{start:2,name:"boxInd",type:"tensor"},{start:3,name:"cropSize",type:"number[]"}],attrs:[{tfName:"method",name:"method",type:"string"},{tfName:"extrapolation_value",name:"extrapolationValue",type:"number"}]},{tfOpName:"ImageProjectiveTransformV3",category:"image",inputs:[{start:0,name:"images",type:"tensor"},{start:1,name:"transforms",type:"tensor"},{start:2,name:"outputShape",type:"number[]"},{start:3,name:"fillValue",type:"number"}],attrs:[{tfName:"interpolation",name:"interpolation",type:"string"},{tfName:"fill_mode",name:"fillMode",type:"string"}]}];var pw=Object.freeze({__proto__:null,json:lw});/**
 * @license
 * Copyright 2022 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */const hw=[{tfOpName:"Equal",category:"logical",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"NotEqual",category:"logical",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Greater",category:"logical",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"GreaterEqual",category:"logical",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Less",category:"logical",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"LessEqual",category:"logical",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"LogicalAnd",category:"logical",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"LogicalNot",category:"logical",inputs:[{start:0,name:"a",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"LogicalOr",category:"logical",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Select",category:"logical",inputs:[{start:0,name:"condition",type:"tensor"},{start:1,name:"a",type:"tensor"},{start:2,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"SelectV2",category:"logical",inputs:[{start:0,name:"condition",type:"tensor"},{start:1,name:"a",type:"tensor"},{start:2,name:"b",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]}];var fw=Object.freeze({__proto__:null,json:hw});/**
 * @license
 * Copyright 2022 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */const mw=[{tfOpName:"_FusedMatMul",category:"matrices",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"},{start:2,end:0,name:"args",type:"tensors"}],attrs:[{tfName:"num_args",name:"numArgs",type:"number"},{tfName:"fused_ops",name:"fusedOps",type:"string[]",defaultValue:[]},{tfName:"epsilon",name:"epsilon",type:"number",defaultValue:1e-4},{tfName:"transpose_a",name:"transposeA",type:"bool",defaultValue:!1},{tfName:"transpose_b",name:"transposeB",type:"bool",defaultValue:!1},{tfName:"leakyrelu_alpha",name:"leakyreluAlpha",type:"number",defaultValue:.2},{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"MatMul",category:"matrices",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"transpose_a",name:"transposeA",type:"bool",defaultValue:!1},{tfName:"transpose_b",name:"transposeB",type:"bool",defaultValue:!1},{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"BatchMatMul",category:"matrices",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"adj_x",name:"transposeA",type:"bool",defaultValue:!1},{tfName:"adj_y",name:"transposeB",type:"bool",defaultValue:!1},{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"BatchMatMulV2",category:"matrices",inputs:[{start:0,name:"a",type:"tensor"},{start:1,name:"b",type:"tensor"}],attrs:[{tfName:"adj_x",name:"transposeA",type:"bool",defaultValue:!1},{tfName:"adj_y",name:"transposeB",type:"bool",defaultValue:!1},{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Transpose",category:"matrices",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"perm",type:"number[]"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"Einsum",category:"matrices",inputs:[{start:0,end:0,name:"tensors",type:"tensors"}],attrs:[{tfName:"equation",name:"equation",type:"string"},{tfName:"N",name:"n",type:"number",defaultValue:2},{tfName:"T",name:"dtype",type:"dtype"}]}];var dw=Object.freeze({__proto__:null,json:mw});/**
 * @license
 * Copyright 2022 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */const gw=[{tfOpName:"EuclideanNorm",category:"normalization",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"axis",type:"number[]"}],attrs:[{tfName:"keep_dims",name:"keepDims",type:"bool",defaultValue:!1}]},{tfOpName:"FusedBatchNorm",category:"normalization",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"scale",type:"tensor"},{start:2,name:"offset",type:"tensor"},{start:3,name:"mean",type:"tensor"},{start:4,name:"variance",type:"tensor"}],attrs:[{tfName:"epsilon",name:"epsilon",type:"number",defaultValue:.001},{tfName:"data_format",name:"dataFormat",type:"string",notSupported:!0}]},{tfOpName:"FusedBatchNormV2",category:"normalization",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"scale",type:"tensor"},{start:2,name:"offset",type:"tensor"},{start:3,name:"mean",type:"tensor"},{start:4,name:"variance",type:"tensor"}],attrs:[{tfName:"epsilon",name:"epsilon",type:"number",defaultValue:.001},{tfName:"data_format",name:"dataFormat",type:"string",notSupported:!0}]},{tfOpName:"FusedBatchNormV3",category:"normalization",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"scale",type:"tensor"},{start:2,name:"offset",type:"tensor"},{start:3,name:"mean",type:"tensor"},{start:4,name:"variance",type:"tensor"}],attrs:[{tfName:"epsilon",name:"epsilon",type:"number",defaultValue:.001},{tfName:"data_format",name:"dataFormat",type:"string",notSupported:!0}]},{tfOpName:"LRN",category:"normalization",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"depth_radius",name:"radius",type:"number",defaultValue:5},{tfName:"bias",name:"bias",type:"number",defaultValue:1},{tfName:"alpha",name:"alpha",type:"number",defaultValue:1},{tfName:"beta",name:"beta",type:"number",defaultValue:.5}]},{tfOpName:"Softmax",category:"normalization",inputs:[{start:0,name:"x",type:"tensor"}]},{tfOpName:"LogSoftmax",category:"normalization",inputs:[{start:0,name:"x",type:"tensor"}]},{tfOpName:"SparseToDense",category:"normalization",inputs:[{start:0,name:"sparseIndices",type:"tensor"},{start:1,name:"outputShape",type:"number[]"},{start:2,name:"sparseValues",type:"tensor"},{start:3,name:"defaultValue",type:"tensor"}],attrs:[{tfName:"validate_indices",name:"validateIndices",type:"bool",defaultValue:!0,notSupported:!0}]}];var yw=Object.freeze({__proto__:null,json:gw});/**
 * @license
 * Copyright 2022 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */const bw=[{tfOpName:"Bincount",category:"reduction",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"size",type:"number"},{start:2,name:"weights",type:"tensor"}]},{tfOpName:"DenseBincount",category:"reduction",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"size",type:"number"},{start:2,name:"weights",type:"tensor"}],attrs:[{tfName:"binary_output",name:"binaryOutput",type:"bool"}]},{tfOpName:"Max",category:"reduction",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"axis",type:"number[]"}],attrs:[{tfName:"keep_dims",name:"keepDims",type:"bool"}]},{tfOpName:"Mean",category:"reduction",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"axis",type:"number[]"}],attrs:[{tfName:"keep_dims",name:"keepDims",type:"bool"}]},{tfOpName:"Min",category:"reduction",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"axis",type:"number[]"}],attrs:[{tfName:"keep_dims",name:"keepDims",type:"bool"}]},{tfOpName:"Sum",category:"reduction",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"axis",type:"number[]"}],attrs:[{tfName:"keep_dims",name:"keepDims",type:"bool"}]},{tfOpName:"All",category:"reduction",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"axis",type:"number[]"}],attrs:[{tfName:"keep_dims",name:"keepDims",type:"bool"}]},{tfOpName:"Any",category:"reduction",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"axis",type:"number[]"}],attrs:[{tfName:"keep_dims",name:"keepDims",type:"bool"}]},{tfOpName:"ArgMax",category:"reduction",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"axis",type:"number"}]},{tfOpName:"ArgMin",category:"reduction",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"axis",type:"number"}]},{tfOpName:"Prod",category:"reduction",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"axis",type:"number[]"}],attrs:[{tfName:"keep_dims",name:"keepDims",type:"bool"}]},{tfOpName:"Cumprod",category:"reduction",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"axis",type:"number"}],attrs:[{tfName:"exclusive",name:"exclusive",type:"bool"},{tfName:"reverse",name:"reverse",type:"bool"}]},{tfOpName:"Cumsum",category:"reduction",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"axis",type:"number"}],attrs:[{tfName:"exclusive",name:"exclusive",type:"bool"},{tfName:"reverse",name:"reverse",type:"bool"}]}];var ww=Object.freeze({__proto__:null,json:bw});/**
 * @license
 * Copyright 2022 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */const Nw=[{tfOpName:"ConcatV2",category:"slice_join",inputs:[{start:0,end:-1,name:"tensors",type:"tensors"},{start:-1,name:"axis",type:"number"}],attrs:[{tfName:"N",name:"n",type:"number",defaultValue:2}]},{tfOpName:"Concat",category:"slice_join",inputs:[{start:1,end:0,name:"tensors",type:"tensors"},{start:0,name:"axis",type:"number"}],attrs:[{tfName:"N",name:"n",type:"number",defaultValue:2}]},{tfOpName:"GatherV2",category:"slice_join",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"indices",type:"tensor"},{start:2,name:"axis",type:"number",defaultValue:0}],attrs:[{tfName:"batch_dims",name:"batchDims",type:"number",defaultValue:0}]},{tfOpName:"Gather",category:"slice_join",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"indices",type:"tensor"}],attrs:[{tfName:"validate_indices",name:"validateIndices",type:"bool",notSupported:!0}]},{tfOpName:"Reverse",category:"slice_join",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"dims",type:"bool[]"}]},{tfOpName:"ReverseV2",category:"slice_join",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"axis",type:"number[]"}]},{tfOpName:"Slice",category:"slice_join",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"begin",type:"number[]"},{start:2,name:"size",type:"number[]"}]},{tfOpName:"StridedSlice",category:"slice_join",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"begin",type:"number[]"},{start:2,name:"end",type:"number[]"},{start:3,name:"strides",type:"number[]"}],attrs:[{tfName:"begin_mask",name:"beginMask",type:"number",defaultValue:0},{tfName:"end_mask",name:"endMask",type:"number",defaultValue:0},{tfName:"new_axis_mask",name:"newAxisMask",type:"number",defaultValue:0},{tfName:"ellipsis_mask",name:"ellipsisMask",type:"number",defaultValue:0},{tfName:"shrink_axis_mask",name:"shrinkAxisMask",type:"number",defaultValue:0}]},{tfOpName:"Pack",category:"slice_join",inputs:[{start:0,end:0,name:"tensors",type:"tensors"}],attrs:[{tfName:"axis",name:"axis",type:"number",defaultValue:0}]},{tfOpName:"Unpack",category:"slice_join",inputs:[{start:0,name:"tensor",type:"tensor"}],attrs:[{tfName:"axis",name:"axis",type:"number",defaultValue:0},{tfName:"num",name:"num",type:"number",defaultValue:0,notSupported:!0}]},{tfOpName:"Tile",category:"slice_join",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"reps",type:"number[]"}]},{tfOpName:"Split",category:"slice_join",inputs:[{start:0,name:"axis",type:"number",defaultValue:0},{start:1,name:"x",type:"tensor"}],attrs:[{tfName:"num_split",name:"numOrSizeSplits",type:"number",defaultValue:1}]},{tfOpName:"SplitV",category:"slice_join",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"numOrSizeSplits",type:"number[]"},{start:2,name:"axis",type:"number",defaultValue:0}]},{tfOpName:"ScatterNd",category:"slice_join",inputs:[{start:0,name:"indices",type:"tensor"},{start:1,name:"values",type:"tensor"},{start:2,name:"shape",type:"number[]"}]},{tfOpName:"GatherNd",category:"slice_join",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"indices",type:"tensor"}]},{tfOpName:"SparseToDense",category:"slice_join",inputs:[{start:0,name:"sparseIndices",type:"tensor"},{start:1,name:"outputShape",type:"number[]"},{start:2,name:"sparseValues",type:"tensor"},{start:3,name:"defaultValue",type:"tensor"}],attrs:[{tfName:"validate_indices",name:"validateIndices",type:"bool",defaultValue:!1,notSupported:!0}]}];var Tw=Object.freeze({__proto__:null,json:Nw});/**
 * @license
 * Copyright 2022 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */const Sw=[{tfOpName:"SparseFillEmptyRows",category:"sparse",inputs:[{start:0,name:"indices",type:"tensor"},{start:1,name:"values",type:"tensor"},{start:2,name:"denseShape",type:"tensor"},{start:3,name:"defaultValue",type:"tensor"}]},{tfOpName:"SparseReshape",category:"sparse",inputs:[{start:0,name:"inputIndices",type:"tensor"},{start:1,name:"inputShape",type:"tensor"},{start:2,name:"newShape",type:"tensor"}],attrs:[{tfName:"T",name:"dtype",type:"dtype",notSupported:!0}]},{tfOpName:"SparseSegmentMean",category:"sparse",inputs:[{start:0,name:"data",type:"tensor"},{start:1,name:"indices",type:"tensor"},{start:2,name:"segmentIds",type:"tensor"}]},{tfOpName:"SparseSegmentSum",category:"sparse",inputs:[{start:0,name:"data",type:"tensor"},{start:1,name:"indices",type:"tensor"},{start:2,name:"segmentIds",type:"tensor"}]}];var $w=Object.freeze({__proto__:null,json:Sw});/**
 * @license
 * Copyright 2022 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */const kw=[{tfOpName:"FFT",category:"spectral",inputs:[{start:0,name:"x",type:"tensor"}]},{tfOpName:"IFFT",category:"spectral",inputs:[{start:0,name:"x",type:"tensor"}]},{tfOpName:"RFFT",category:"spectral",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"fft_length",type:"number",notSupported:!0}]},{tfOpName:"IRFFT",category:"spectral",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"fft_length",type:"number",notSupported:!0}]}];var Ew=Object.freeze({__proto__:null,json:kw});/**
 * @license
 * Copyright 2022 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */const vw=[{tfOpName:"StringNGrams",category:"string",inputs:[{start:0,name:"data",type:"tensor"},{start:1,name:"dataSplits",type:"tensor"}],attrs:[{tfName:"separator",name:"separator",type:"string"},{tfName:"ngram_widths",name:"nGramWidths",type:"number[]"},{tfName:"left_pad",name:"leftPad",type:"string"},{tfName:"right_pad",name:"rightPad",type:"string"},{tfName:"pad_width",name:"padWidth",type:"number"},{tfName:"preserve_short_sequences",name:"preserveShortSequences",type:"bool"}],outputs:["ngrams","ngrams_splits"]},{tfOpName:"StringSplit",category:"string",inputs:[{start:0,name:"input",type:"tensor"},{start:1,name:"delimiter",type:"tensor"}],attrs:[{tfName:"skip_empty",name:"skipEmpty",type:"bool"}],outputs:["indices","values","shape"]},{tfOpName:"StringToHashBucketFast",category:"string",inputs:[{start:0,name:"input",type:"tensor"}],attrs:[{tfName:"num_buckets",name:"numBuckets",type:"number"}]}];var _w=Object.freeze({__proto__:null,json:vw});/**
 * @license
 * Copyright 2022 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */const xw=[{tfOpName:"Cast",category:"transformation",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"SrcT",name:"sdtype",type:"dtype",notSupported:!0},{tfName:"DstT",name:"dtype",type:"dtype"}]},{tfOpName:"ExpandDims",category:"transformation",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"axis",type:"number"}]},{tfOpName:"MirrorPad",category:"transformation",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"padding",type:"number[]"}],attrs:[{tfName:"mode",name:"mode",type:"string"}]},{tfOpName:"Pad",category:"transformation",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"padding",type:"number[]"}],attrs:[{tfName:"constant_value",name:"constantValue",type:"number",defaultValue:0}]},{tfOpName:"PadV2",category:"transformation",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"padding",type:"number[]"},{start:2,name:"constantValue",type:"number",defaultValue:0}]},{tfOpName:"Reshape",category:"transformation",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"shape",type:"number[]"}]},{tfOpName:"Squeeze",category:"transformation",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"axis",tfDeprecatedName:"squeeze_dims",name:"axis",type:"number[]"}]},{tfOpName:"SpaceToBatchND",category:"transformation",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"blockShape",type:"number[]"},{start:2,name:"paddings",type:"number[]"}]},{tfOpName:"BatchToSpaceND",category:"transformation",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"blockShape",type:"number[]"},{start:2,name:"crops",type:"number[]"}]},{tfOpName:"DepthToSpace",category:"transformation",inputs:[{start:0,name:"x",type:"tensor"}],attrs:[{tfName:"block_size",name:"blockSize",type:"number"},{tfName:"data_format",name:"dataFormat",type:"string"}]},{tfOpName:"BroadcastTo",category:"transformation",inputs:[{start:0,name:"x",type:"tensor"},{start:1,name:"shape",type:"number[]"}],attrs:[]},{tfOpName:"BroadcastArgs",category:"transformation",inputs:[{start:0,name:"s0",type:"tensor"},{start:1,name:"s1",type:"tensor"}],attrs:[]}];var Iw=Object.freeze({__proto__:null,json:xw});/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */class br{static get Instance(){return this._instance||(this._instance=new this)}constructor(){const t=[Gb,Xb,Jb,Qb,ew,sw,aw,iw,cw,pw,fw,dw,yw,ww,Tw,$w,Ew,_w,Iw],n=[].concat(...t.map(s=>s.json));this.opMappers=n.reduce((s,r)=>(s[r.tfOpName]=r,s),{})}transformGraph(t,n={}){const s=t.node,r=[],a=[],o=[],i=s.reduce((T,S)=>(T[S.name]=this.mapNode(S),S.op.startsWith("Placeholder")?r.push(T[S.name]):S.op==="Const"?a.push(T[S.name]):(S.input==null||S.input.length===0)&&o.push(T[S.name]),T),{});let u=[];const c=[];let h={},p={};n!=null&&(h=this.mapSignatureEntries(n.inputs),p=this.mapSignatureEntries(n.outputs));const f=Object.keys(i);f.forEach(T=>{const S=i[T];S.inputNames.forEach(($,O)=>{const[I,,_]=_t($),A=i[I];if(A.outputs!=null){const D=A.outputs.indexOf(_);if(D!==-1){const B=`${I}:${D}`;S.inputNames[O]=B}}S.inputs.push(A),A.children.push(S)})}),Object.keys(p).length===0?f.forEach(T=>{const S=i[T];S.children.length===0&&c.push(S)}):Object.keys(p).forEach(T=>{const[S]=_t(T),$=i[S];$!=null&&($.signatureKey=p[T],c.push($))}),Object.keys(h).length>0?Object.keys(h).forEach(T=>{const[S]=_t(T),$=i[S];$&&($.signatureKey=h[T],u.push($))}):u=r;let d={};t.library!=null&&t.library.function!=null&&(d=t.library.function.reduce((T,S)=>(T[S.signature.name]=this.mapFunction(S),T),{}));const w={nodes:i,inputs:u,outputs:c,weights:a,placeholders:r,signature:n,functions:d};return o.length>0&&(w.initNodes=o),w}mapSignatureEntries(t){return Object.keys(t||{}).reduce((n,s)=>(n[t[s].name]=s,n),{})}mapNode(t){const n=Qa(t.op)||this.opMappers[t.op]||{};t.attr==null&&(t.attr={});const s={name:t.name,op:t.op,category:n.category,inputNames:(t.input||[]).map(r=>r.startsWith("^")?r.slice(1):r),inputs:[],children:[],inputParams:{},attrParams:{},rawAttrs:t.attr,outputs:n.outputs};return n.inputs!=null&&(s.inputParams=n.inputs.reduce((r,a)=>(r[a.name]={type:a.type,inputIndexStart:a.start,inputIndexEnd:a.end},r),{})),n.attrs!=null&&(s.attrParams=n.attrs.reduce((r,a)=>{const o=a.type;let i;switch(a.type){case"string":i=ss(t.attr,a.tfName,a.defaultValue),i===void 0&&a.tfDeprecatedName&&(i=ss(t.attr,a.tfDeprecatedName,a.defaultValue));break;case"string[]":i=ls(t.attr,a.tfName,a.defaultValue),i===void 0&&a.tfDeprecatedName&&(i=ls(t.attr,a.tfDeprecatedName,a.defaultValue));break;case"number":i=as(t.attr,a.tfName,a.defaultValue||0),i===void 0&&a.tfDeprecatedName&&(i=as(t.attr,a.tfDeprecatedName,a.defaultValue));break;case"number[]":i=cs(t.attr,a.tfName,a.defaultValue),i===void 0&&a.tfDeprecatedName&&(i=cs(t.attr,a.tfDeprecatedName,a.defaultValue));break;case"bool":i=rs(t.attr,a.tfName,a.defaultValue),i===void 0&&a.tfDeprecatedName&&(i=rs(t.attr,a.tfDeprecatedName,a.defaultValue));break;case"bool[]":i=hs(t.attr,a.tfName,a.defaultValue),i===void 0&&a.tfDeprecatedName&&(i=hs(t.attr,a.tfDeprecatedName,a.defaultValue));break;case"shape":i=us(t.attr,a.tfName,a.defaultValue),i===void 0&&a.tfDeprecatedName&&(i=us(t.attr,a.tfDeprecatedName,a.defaultValue));break;case"shape[]":i=ps(t.attr,a.tfName,a.defaultValue),i===void 0&&a.tfDeprecatedName&&(i=ps(t.attr,a.tfDeprecatedName,a.defaultValue));break;case"dtype":i=os(t.attr,a.tfName,a.defaultValue),i===void 0&&a.tfDeprecatedName&&(i=os(t.attr,a.tfDeprecatedName,a.defaultValue));break;case"dtype[]":i=is(t.attr,a.tfName,a.defaultValue),i===void 0&&a.tfDeprecatedName&&(i=is(t.attr,a.tfDeprecatedName,a.defaultValue));break;case"func":i=wr(t.attr,a.tfName,a.defaultValue),i===void 0&&a.tfDeprecatedName&&(i=wr(t.attr,a.tfDeprecatedName,a.defaultValue));break;case"tensor":case"tensors":break;default:throw new Error(`Unsupported param type: ${a.type} for op: ${t.op}`)}return r[a.name]={value:i,type:o},r},{})),s}mapFunction(t){const n=t.nodeDef,s=[],r=[];let a={};n!=null&&(a=n.reduce((p,f)=>(p[f.name]=this.mapNode(f),f.op==="Const"&&r.push(p[f.name]),p),{}));const o=[],i=[];t.signature.inputArg.forEach(p=>{const[f]=_t(p.name),d={name:f,op:"Placeholder",inputs:[],inputNames:[],category:"graph",inputParams:{},attrParams:{dtype:{value:js(p.type),type:"dtype"}},children:[]};d.signatureKey=p.name,o.push(d),a[f]=d}),Object.keys(a).forEach(p=>{const f=a[p];f.inputNames.forEach((d,w)=>{const[T,,S]=_t(d),$=a[T];if($.outputs!=null){const O=$.outputs.indexOf(S);if(O!==-1){const I=`${T}:${O}`;f.inputNames[w]=I}}f.inputs.push($),$.children.push(f)})});const c=t.ret;t.signature.outputArg.forEach(p=>{const[f,d]=_t(c[p.name]),w=a[f];w!=null&&(w.defaultOutput=d,i.push(w))});const h=this.mapArgsToSignature(t);return{nodes:a,inputs:o,outputs:i,weights:r,placeholders:s,signature:h}}mapArgsToSignature(t){return{methodName:t.signature.name,inputs:t.signature.inputArg.reduce((n,s)=>(n[s.name]=this.mapArgToTensorInfo(s),n),{}),outputs:t.signature.outputArg.reduce((n,s)=>(n[s.name]=this.mapArgToTensorInfo(s,t.ret),n),{})}}mapArgToTensorInfo(t,n){let s=t.name;return n!=null&&(s=n[s]),{name:s,dtype:t.type}}}function Aw(e){const t=R().global;if(typeof t.atob<"u")return t.atob(e);if(typeof Buffer<"u")return new Buffer(e,"base64").toString();throw new Error("Unable to decode base64 in this environment. Missing built-in atob() or Buffer()")}function to(e,t){const n=Array.isArray(e)?String.fromCharCode.apply(null,e):Aw(e);return t?n:n.toLowerCase()}function ss(e,t,n,s=!1){const r=e[t];return r!=null?to(r.s,s):n}function rs(e,t,n){const s=e[t];return s?s.b:n}function as(e,t,n){const s=e[t]||{},r=s.i!=null?s.i:s.f!=null?s.f:n;return typeof r=="number"?r:parseInt(r,10)}function js(e){switch(typeof e=="string"&&(e=wt[e]),e){case wt.DT_FLOAT:case wt.DT_HALF:return"float32";case wt.DT_INT32:case wt.DT_INT64:case wt.DT_INT8:case wt.DT_UINT8:return"int32";case wt.DT_BOOL:return"bool";case wt.DT_DOUBLE:return"float32";case wt.DT_STRING:return"string";default:return null}}function wr(e,t,n){const s=e[t];return s&&s.func?s.func.name:n}function os(e,t,n){const s=e[t];return s&&s.type?js(s.type):n}function is(e,t,n){const s=e[t];return s&&s.list&&s.list.type?s.list.type.map(r=>js(r)):n}function eo(e){if(!e.unknownRank)return e.dim!=null?e.dim.map(t=>typeof t.size=="number"?t.size:parseInt(t.size,10)):[]}function us(e,t,n){const s=e[t];return s&&s.shape?eo(s.shape):n}function cs(e,t,n){const s=e[t];return s?((s.list.f&&s.list.f.length?s.list.f:s.list.i)||[]).map(r=>typeof r=="number"?r:parseInt(r,10)):n}function ls(e,t,n,s=!1){const r=e[t];return r&&r.list&&r.list.s?r.list.s.map(a=>to(a,s)):n}function ps(e,t,n){const s=e[t];return s&&s.list&&s.list.shape?s.list.shape.map(r=>eo(r)):n}function hs(e,t,n){const s=e[t];return s&&s.list&&s.list.b?s.list.b:n}/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */class Dw{constructor(t,n,s){this.node=t,this.tensorMap=n,this.context=s,this.inputs=[],this.attrs={},this.inputs=t.inputNames.map(r=>this.getInput(r)),t.rawAttrs!=null&&(this.attrs=Object.keys(t.rawAttrs).reduce((r,a)=>(r[a]=this.getAttr(a),r),{}))}getInput(t){return ct(t,this.tensorMap,this.context)}getAttr(t,n){const s=this.node.rawAttrs[t];if(s.tensor!=null)return ct(t,this.tensorMap,this.context);if(s.i!=null||s.f!=null)return as(this.node.rawAttrs,t,n);if(s.s!=null)return ss(this.node.rawAttrs,t,n);if(s.b!=null)return rs(this.node.rawAttrs,t,n);if(s.shape!=null)return us(this.node.rawAttrs,t,n);if(s.type!=null)return os(this.node.rawAttrs,t,n);if(s.list!=null){if(s.list.i!=null||s.list.f!=null)return cs(this.node.rawAttrs,t,n);if(s.list.s!=null)return ls(this.node.rawAttrs,t,n);if(s.list.shape!=null)return ps(this.node.rawAttrs,t,n);if(s.list.b!=null)return hs(this.node.rawAttrs,t,n);if(s.list.type!=null)return is(this.node.rawAttrs,t,n)}return n}}/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */var ot=Object.freeze({__proto__:null,OP_SCOPE_SUFFIX:Zr,abs:Nt,acos:up,acosh:lp,add:rt,addN:hp,all:mp,any:gp,argMax:bp,argMin:Np,asin:Sp,asinh:kp,atan:vp,atan2:xp,atanh:Ap,avgPool:wa,avgPool3d:qp,basicLSTMCell:Gp,batchNorm:wn,batchNorm2d:Zp,batchNorm3d:th,batchNorm4d:nh,batchToSpaceND:Na,bincount:Ta,booleanMaskAsync:Cg,broadcastArgs:ah,broadcastTo:He,buffer:Ft,cast:st,ceil:uh,clipByValue:lh,clone:Vt,complex:Ut,concat:pt,concat1d:hh,concat2d:mh,concat3d:gh,concat4d:bh,conv1d:Th,conv2d:Tn,conv2dTranspose:kh,conv3d:vh,conv3dTranspose:Ah,cos:Oh,cosh:Ch,cosineWindow:Ps,cumprod:Lh,cumsum:Rh,denseBincount:Vh,depthToSpace:Uh,depthwiseConv2d:_s,diag:Kh,dilation2d:Gh,div:lt,divNoNan:Zh,dot:tf,dropout:Hg,einsum:nf,elu:ka,enclosingPowerOfTwo:Ya,equal:$a,erf:af,euclideanNorm:gf,exp:re,expandDims:Gt,expm1:Nf,eye:_a,fft:Cs,fill:Nn,floor:xa,floorDiv:ya,fused:iy,gather:Ia,gatherND:Wg,greater:En,greaterEqual:Aa,ifft:ln,imag:yn,image:zb,inTopKAsync:Mg,irfft:Ha,isFinite:xf,isInf:Af,isNaN:Of,leakyRelu:Da,less:Bf,lessEqual:As,linalg:Vb,linspace:Pf,localResponseNormalization:zf,log:Oe,log1p:Oa,logSigmoid:jf,logSoftmax:Gf,logSumExp:Ca,logicalAnd:un,logicalNot:Ba,logicalOr:La,logicalXor:Qf,losses:qb,lowerBound:em,matMul:W,max:me,maxPool:Pa,maxPool3d:rm,maxPoolWithArgmax:om,maximum:um,mean:cn,meshgrid:lm,min:es,minimum:Ra,mirrorPad:fm,mod:dm,moments:ym,movingAverage:Lg,mul:z,multiRNNCell:wm,multinomial:Tm,neg:Dt,norm:kn,notEqual:za,oneHot:Gl,ones:Jt,onesLike:km,op:b,outerProduct:vm,pad:Ve,pad1d:Im,pad2d:Dm,pad3d:Fm,pad4d:Bm,pool:Vm,pow:Is,prelu:qa,print:ua,prod:Wm,raggedGather:Km,raggedTensorToTensor:Gm,rand:Xm,randomGamma:dd,randomNormal:Ua,randomStandardNormal:bd,randomUniform:Wa,range:Fe,real:De,reciprocal:Td,relu:_n,relu6:ja,reshape:v,reverse:ae,reverse1d:vd,reverse2d:xd,reverse3d:Ad,reverse4d:Od,rfft:Bs,round:Ka,rsqrt:Bd,scalar:U,scatterND:Rg,searchSorted:Ds,selu:Pd,separableConv2d:zd,setdiff1dAsync:qd,sigmoid:fe,sign:Wd,signal:Rb,sin:Kd,sinh:Gd,slice:K,slice1d:Xd,slice2d:Jd,slice3d:Qd,slice4d:eg,softmax:sg,softplus:Fa,spaceToBatchND:Va,sparse:Ub,sparseToDense:qg,spectral:Pb,split:Ce,sqrt:ns,square:$n,squaredDifference:Ga,squeeze:Ls,stack:Bt,step:Ma,stridedSlice:mg,string:Wb,sub:V,sum:H,tan:gg,tanh:ts,tensor:xt,tensor1d:$t,tensor2d:_e,tensor3d:tp,tensor4d:yg,tensor5d:bg,tensor6d:wg,tile:ve,topk:Tg,transpose:Zn,truncatedNormal:$g,unique:Eg,unsortedSegmentSum:_g,unstack:ue,upperBound:Ig,variable:Ag,where:be,whereAsync:Xa,zeros:we,zerosLike:xs});/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */const Ow=(e,t,n,s=ot)=>{switch(e.op){case"BiasAdd":case"AddV2":case"Add":return[s.add(l("a",e,t,n),l("b",e,t,n))];case"AddN":return[s.addN(l("tensors",e,t,n))];case"FloorMod":case"Mod":return[s.mod(l("a",e,t,n),l("b",e,t,n))];case"Mul":return[s.mul(l("a",e,t,n),l("b",e,t,n))];case"RealDiv":case"Div":return[s.div(l("a",e,t,n),l("b",e,t,n))];case"DivNoNan":return[s.divNoNan(l("a",e,t,n),l("b",e,t,n))];case"FloorDiv":return[s.floorDiv(l("a",e,t,n),l("b",e,t,n))];case"Sub":return[s.sub(l("a",e,t,n),l("b",e,t,n))];case"Minimum":return[s.minimum(l("a",e,t,n),l("b",e,t,n))];case"Maximum":return[s.maximum(l("a",e,t,n),l("b",e,t,n))];case"Pow":return[s.pow(l("a",e,t,n),l("b",e,t,n))];case"SquaredDifference":return[s.squaredDifference(l("a",e,t,n),l("b",e,t,n))];default:throw TypeError(`Node type ${e.op} is not implemented`)}};/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */const Fw=(e,t,n,s=ot)=>{switch(e.op){case"Abs":case"ComplexAbs":return[s.abs(l("x",e,t,n))];case"Acos":return[s.acos(l("x",e,t,n))];case"Acosh":return[s.acosh(l("x",e,t,n))];case"Asin":return[s.asin(l("x",e,t,n))];case"Asinh":return[s.asinh(l("x",e,t,n))];case"Atan":return[s.atan(l("x",e,t,n))];case"Atan2":return[s.atan2(l("x",e,t,n),l("y",e,t,n))];case"Atanh":return[s.atanh(l("x",e,t,n))];case"Ceil":return[s.ceil(l("x",e,t,n))];case"Complex":return[s.complex(l("real",e,t,n),l("imag",e,t,n))];case"Cos":return[s.cos(l("x",e,t,n))];case"Cosh":return[s.cosh(l("x",e,t,n))];case"Elu":return[s.elu(l("x",e,t,n))];case"Erf":return[s.erf(l("x",e,t,n))];case"Exp":return[s.exp(l("x",e,t,n))];case"Expm1":return[s.expm1(l("x",e,t,n))];case"Floor":return[s.floor(l("x",e,t,n))];case"Log":return[s.log(l("x",e,t,n))];case"Log1p":return[s.log1p(l("x",e,t,n))];case"Imag":return[s.imag(l("x",e,t,n))];case"Neg":return[s.neg(l("x",e,t,n))];case"Reciprocal":return[s.reciprocal(l("x",e,t,n))];case"Real":return[s.real(l("x",e,t,n))];case"Relu":return[s.relu(l("x",e,t,n))];case"Round":return[s.round(l("x",e,t,n))];case"Selu":return[s.selu(l("x",e,t,n))];case"Sigmoid":return[s.sigmoid(l("x",e,t,n))];case"Sin":return[s.sin(l("x",e,t,n))];case"Sign":return[s.sign(l("x",e,t,n))];case"Sinh":return[s.sinh(l("x",e,t,n))];case"Softplus":return[s.softplus(l("x",e,t,n))];case"Sqrt":return[s.sqrt(l("x",e,t,n))];case"Square":return[s.square(l("x",e,t,n))];case"Tanh":return[s.tanh(l("x",e,t,n))];case"Tan":return[s.tan(l("x",e,t,n))];case"ClipByValue":return[s.clipByValue(l("x",e,t,n),l("clipValueMin",e,t,n),l("clipValueMax",e,t,n))];case"Relu6":return[s.relu6(l("x",e,t,n))];case"Rsqrt":return[s.rsqrt(ct(e.inputNames[0],t,n))];case"Prod":return[s.prod(l("x",e,t,n),l("axes",e,t,n))];case"LeakyRelu":return[s.leakyRelu(l("x",e,t,n),l("alpha",e,t,n))];case"Prelu":return[s.prelu(l("x",e,t,n),l("alpha",e,t,n))];case"IsNan":return[s.isNaN(ct(e.inputNames[0],t,n))];default:throw TypeError(`Node type ${e.op} is not implemented`)}};/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Tt(e,t,n=""){if(!(typeof e=="number"||typeof t=="number")){y(e.length===t.length,()=>n+` Shapes ${e} and ${t} must match`);for(let s=0;s<e.length;s++){const r=e[s],a=t[s];y(r<0||a<0||r===a,()=>n+` Shapes ${e} and ${t} must match`)}}}function Nr(e){return!(typeof e=="number"||e.some(t=>t<0))}function Se(e,t,n){let s=fs(e,n);const r=!Nr(s);if(r&&t.length===0)throw new Error(`Tried to calculate elements of an empty list with non-fully-defined elementShape: ${s}`);if(r&&t.forEach(a=>{s=fs(a.shape,s)}),!Nr(s))throw new Error(`Non-fully-defined elementShape: ${s}`);return s}function fs(e,t){if(typeof e=="number")return t;if(typeof t=="number")return e;if(e.length!==t.length)throw new Error(`Incompatible ranks during merge: ${e} vs. ${t}`);const n=[];for(let s=0;s<e.length;++s){const r=e[s],a=t[s];if(r>=0&&a>=0&&r!==a)throw new Error(`Incompatible shape during merge: ${e} vs. ${t}`);n[s]=r>=0?r:a}return n}/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */class Cw{constructor(t,n,s,r,a,o,i){this.name=t,this.dtype=n,this.maxSize=s,this.elementShape=r,this.identicalElementShapes=a,this.dynamicSize=o,this.clearAfterRead=i,this.tensors=[],this.closed_=!1,this.idTensor=U(0),Rt(this.idTensor)}get id(){return this.idTensor.id}get closed(){return this.closed_}clearAndClose(t){this.tensors.forEach(n=>{(t==null||!t.has(n.tensor.id))&&n.tensor.dispose()}),this.tensors=[],this.closed_=!0,this.idTensor.dispose()}size(){return this.tensors.length}read(t){if(this.closed_)throw new Error(`TensorArray ${this.name} has already been closed.`);if(t<0||t>=this.size())throw new Error(`Tried to read from index ${t}, but array size is: ${this.size()}`);const n=this.tensors[t];if(n.cleared)throw new Error(`TensorArray ${this.name}: Could not read index ${t} twice because it was cleared after a previous read (perhaps try setting clear_after_read = false?).`);return this.clearAfterRead&&(n.cleared=!0),n.read=!0,n.tensor}readMany(t){return t.map(n=>this.read(n))}write(t,n){if(this.closed_)throw new Error(`TensorArray ${this.name} has already been closed.`);if(t<0||!this.dynamicSize&&t>=this.maxSize)throw new Error(`Tried to write to index ${t}, but array is not resizeable and size is: ${this.maxSize}`);const s=this.tensors[t]||{};if(n.dtype!==this.dtype)throw new Error(`TensorArray ${this.name}: Could not write to TensorArray index ${t},
          because the value dtype is ${n.dtype}, but TensorArray dtype is ${this.dtype}.`);if(this.size()===0&&(this.elementShape==null||this.elementShape.length===0)&&(this.elementShape=n.shape),Tt(this.elementShape,n.shape,`TensorArray ${this.name}: Could not write to TensorArray index ${t}.`),s.read)throw new Error(`TensorArray ${this.name}: Could not write to TensorArray index ${t}, because it has already been read.`);if(s.written)throw new Error(`TensorArray ${this.name}: Could not write to TensorArray index ${t}, because it has already been written.`);s.tensor=n,Rt(n),s.written=!0,this.tensors[t]=s}writeMany(t,n){if(t.length!==n.length)throw new Error(`TensorArray ${this.name}: could not write multiple tensors,because the index size: ${t.length} is not the same as tensors size: ${n.length}.`);t.forEach((s,r)=>this.write(s,n[r]))}gather(t,n){if(n&&n!==this.dtype)throw new Error(`TensorArray dtype is ${this.dtype} but gather requested dtype ${n}`);if(t)t=t.slice(0,this.size());else{t=[];for(let r=0;r<this.size();r++)t.push(r)}if(t.length===0)return xt([],[0].concat(this.elementShape));const s=this.readMany(t);return Tt(this.elementShape,s[0].shape,"TensorArray shape mismatch: "),Bt(s,0)}concat(t){if(t&&t!==this.dtype)throw new Error(`TensorArray dtype is ${this.dtype} but concat requested dtype ${t}`);if(this.size()===0)return xt([],[0].concat(this.elementShape));const n=[];for(let r=0;r<this.size();r++)n.push(r);const s=this.readMany(n);return Tt(this.elementShape,s[0].shape,`TensorArray shape mismatch: tensor array shape (${this.elementShape}) vs first tensor shape (${s[0].shape})`),pt(s,0)}scatter(t,n){if(n.dtype!==this.dtype)throw new Error(`TensorArray dtype is ${this.dtype} but tensor has dtype ${n.dtype}`);if(t.length!==n.shape[0])throw new Error(`Expected len(indices) == tensor.shape[0], but saw: ${t.length} vs. ${n.shape[0]}`);const s=Math.max(...t);if(!this.dynamicSize&&s>=this.maxSize)throw new Error(`Max index must be < array size (${s}  vs. ${this.maxSize})`);this.writeMany(t,ue(n,0))}split(t,n){if(n.dtype!==this.dtype)throw new Error(`TensorArray dtype is ${this.dtype} but tensor has dtype ${n.dtype}`);let s=0;const r=t.map(u=>(s+=u,s));if(s!==n.shape[0])throw new Error(`Expected sum of lengths to be equal to
          tensor.shape[0], but sum of lengths is
        ${s}, and tensor's shape is: ${n.shape}`);if(!this.dynamicSize&&t.length!==this.maxSize)throw new Error(`TensorArray's size is not equal to the size of lengths (${this.maxSize} vs. ${t.length}), and the TensorArray is not marked as dynamically resizeable`);const a=s===0?0:n.size/s,o=[];kt(()=>{n=v(n,[1,s,a]);for(let u=0;u<t.length;++u){const h=[0,u===0?0:r[u-1],0],p=[1,t[u],a];o[u]=v(K(n,h,p),this.elementShape)}return o});const i=[];for(let u=0;u<t.length;u++)i[u]=u;this.writeMany(i,o)}}/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */class oe{constructor(t,n,s,r=-1){this.tensors=t,this.elementShape=n,this.elementDtype=s,t!=null&&t.forEach(a=>{if(s!==a.dtype)throw new Error(`Invalid data types; op elements ${s}, but list elements ${a.dtype}`);Tt(n,a.shape,"TensorList shape mismatch: "),Rt(a)}),this.idTensor=U(0),this.maxNumElements=r,Rt(this.idTensor)}get id(){return this.idTensor.id}copy(){return new oe([...this.tensors],this.elementShape,this.elementDtype)}clearAndClose(t){this.tensors.forEach(n=>{(t==null||!t.has(n.id))&&n.dispose()}),this.tensors.length=0,this.idTensor.dispose()}size(){return this.tensors.length}stack(t,n,s=-1){if(n!==this.elementDtype)throw new Error(`Invalid data types; op elements ${n}, but list elements ${this.elementDtype}`);if(s!==-1&&this.tensors.length!==s)throw new Error(`Operation expected a list with ${s} elements but got a list with ${this.tensors.length} elements.`);Tt(t,this.elementShape,"TensorList shape mismatch: ");const r=Se(this.elementShape,this.tensors,t);return kt(()=>{const a=this.tensors.map(o=>v(o,r));return Bt(a,0)})}popBack(t,n){if(n!==this.elementDtype)throw new Error(`Invalid data types; op elements ${n}, but list elements ${this.elementDtype}`);if(this.size()===0)throw new Error("Trying to pop from an empty list.");const s=Se(this.elementShape,this.tensors,t),r=this.tensors.pop();return r.kept=!1,Tt(r.shape,t,"TensorList shape mismatch: "),v(r,s)}pushBack(t){if(t.dtype!==this.elementDtype)throw new Error(`Invalid data types; op elements ${t.dtype}, but list elements ${this.elementDtype}`);if(Tt(t.shape,this.elementShape,"TensorList shape mismatch: "),this.maxNumElements===this.size())throw new Error("Trying to push element into a full list.");Rt(t),this.tensors.push(t)}resize(t){if(t<0)throw new Error(`TensorListResize expects size to be non-negative. Got: ${t}`);if(this.maxNumElements!==-1&&t>this.maxNumElements)throw new Error(`TensorListResize input size ${t} is greater maxNumElement ${this.maxNumElements}.`);const n=new oe([],this.elementShape,this.elementDtype,this.maxNumElements);n.tensors.length=t;for(let s=0;s<Math.min(this.tensors.length,t);++s)n.tensors[s]=this.tensors[s];return n}getItem(t,n,s){if(s!==this.elementDtype)throw new Error(`Invalid data types; op elements ${s}, but list elements ${this.elementDtype}`);if(t<0||t>this.tensors.length)throw new Error(`Trying to access element ${t} in a list with ${this.tensors.length} elements.`);if(this.tensors[t]==null)throw new Error(`element at index ${t} is null.`);Tt(this.tensors[t].shape,n,"TensorList shape mismatch: ");const r=Se(this.elementShape,this.tensors,n);return v(this.tensors[t],r)}setItem(t,n){if(n.dtype!==this.elementDtype)throw new Error(`Invalid data types; op elements ${n.dtype}, but list elements ${this.elementDtype}`);if(t<0||this.maxNumElements!==-1&&t>=this.maxNumElements)throw new Error(`Trying to set element ${t} in a list with max ${this.maxNumElements} elements.`);Tt(this.elementShape,n.shape,"TensorList shape mismatch: "),Rt(n),this.tensors[t]!=null&&(this.tensors[t].kept=!1),this.tensors[t]=n}gather(t,n,s){if(n!==this.elementDtype)throw new Error(`Invalid data types; op elements ${n}, but list elements ${this.elementDtype}`);Tt(this.elementShape,s,"TensorList shape mismatch: "),t=t.slice(0,this.size());const r=Se(this.elementShape,this.tensors,s);return t.length===0?xt([],[0].concat(r)):kt(()=>{const a=t.map(o=>v(this.tensors[o],r));return Bt(a,0)})}concat(t,n){if(t&&t!==this.elementDtype)throw new Error(`TensorList dtype is ${this.elementDtype} but concat requested dtype ${t}`);Tt(this.elementShape,n,"TensorList shape mismatch: ");const s=Se(this.elementShape,this.tensors,n);return this.size()===0?xt([],[0].concat(s)):kt(()=>{const r=this.tensors.map(a=>v(a,s));return pt(r,0)})}}function Bw(e,t,n){const s=e.dtype;if(e.shape.length<1)throw new Error(`Tensor must be at least a vector, but saw shape: ${e.shape}`);if(e.dtype!==n)throw new Error(`Invalid data types; op elements ${e.dtype}, but list elements ${n}`);const r=e.shape.slice(1);Tt(r,t,"TensorList shape mismatch: ");const a=ue(e);return new oe(a,t,s)}function Lw(e,t,n,s){return new oe([],e,t,s)}function Pw(e,t,n,s){if(t.length!==e.shape[0])throw new Error(`Expected len(indices) == tensor.shape[0], but saw: ${t.length} vs. ${e.shape[0]}`);const r=Math.max(...t);if(s!=null&&s!==-1&&r>=s)throw new Error(`Max index must be < array size (${r}  vs. ${s})`);const a=new oe([],n,e.dtype,s),o=ue(e,0);return t.forEach((i,u)=>{a.setItem(i,o[u])}),a}function Rw(e,t,n){let s=0;const r=t.map(h=>(s+=h,s));if(s!==e.shape[0])throw new Error(`Expected sum of lengths to be equal to
          tensor.shape[0], but sum of lengths is
        ${s}, and tensor's shape is: ${e.shape}`);const a=e.shape.slice(1),o=fs(a,n),i=s===0?0:e.size/s,u=kt(()=>{const h=[];e=v(e,[1,s,i]);for(let p=0;p<t.length;++p){const d=[0,p===0?0:r[p-1],0],w=[1,t[p],i];h[p]=v(K(e,d,w),o)}return e.dispose(),h}),c=new oe([],n,e.dtype,t.length);for(let h=0;h<u.length;h++)c.setItem(h,u[h]);return c}/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */const zw=async(e,t,n)=>{switch(e.op){case"If":case"StatelessIf":{const s=l("thenBranch",e,t,n),r=l("elseBranch",e,t,n),a=l("cond",e,t,n),o=l("args",e,t,n);return(await a.data())[0]?n.functionMap[s].executeFunctionAsync(o,n.tensorArrayMap,n.tensorListMap):n.functionMap[r].executeFunctionAsync(o,n.tensorArrayMap,n.tensorListMap)}case"While":case"StatelessWhile":{const s=l("body",e,t,n),r=l("cond",e,t,n),a=l("args",e,t,n),o=await n.functionMap[r].executeFunctionAsync(a,n.tensorArrayMap,n.tensorListMap),i=a.map(h=>h.id);let u=await o[0].data();o.forEach(h=>{!h.kept&&i.indexOf(h.id)===-1&&h.dispose()});let c=a;for(;u[0];){const h=c;c=await n.functionMap[s].executeFunctionAsync(c,n.tensorArrayMap,n.tensorListMap);const p=c.map(d=>d.id);h.forEach(d=>{!d.kept&&i.indexOf(d.id)===-1&&p.indexOf(d.id)===-1&&d.dispose()});const f=await n.functionMap[r].executeFunctionAsync(c,n.tensorArrayMap,n.tensorListMap);u=await f[0].data(),f.forEach(d=>{!d.kept&&i.indexOf(d.id)===-1&&p.indexOf(d.id)===-1&&d.dispose()})}return c}case"LoopCond":{const s=l("pred",e,t,n);return[It(s)]}case"Switch":{const s=l("pred",e,t,n);let r=l("data",e,t,n);return r.kept||(r=It(r)),(await s.data())[0]?[void 0,r]:[r,void 0]}case"Merge":{const s=e.inputNames.find(r=>ct(r,t,n)!==void 0);if(s){const r=ct(s,t,n);return[It(r)]}return}case"Enter":{const s=l("frameName",e,t,n),r=l("tensor",e,t,n);return n.enterFrame(s),[It(r)]}case"Exit":{const s=l("tensor",e,t,n);return n.exitFrame(),[It(s)]}case"NextIteration":{const s=l("tensor",e,t,n);return n.nextIteration(),[It(s)]}case"TensorArrayV3":{const s=l("size",e,t,n),r=l("dtype",e,t,n),a=l("elementShape",e,t,n),o=l("dynamicSize",e,t,n),i=l("clearAfterRead",e,t,n),u=l("identicalElementShapes",e,t,n),c=l("name",e,t,n),h=new Cw(c,r,s,a,u,o,i);return n.addTensorArray(h),[h.idTensor,U(1)]}case"TensorArrayWriteV3":{const s=l("tensorArrayId",e,t,n),r=l("index",e,t,n),a=l("tensor",e,t,n),o=n.getTensorArray(s.id);return o.write(r,a),[o.idTensor]}case"TensorArrayReadV3":{const s=l("tensorArrayId",e,t,n),r=l("index",e,t,n);return[n.getTensorArray(s.id).read(r)]}case"TensorArrayGatherV3":{const s=l("tensorArrayId",e,t,n),r=l("indices",e,t,n),a=l("dtype",e,t,n);return[n.getTensorArray(s.id).gather(r,a)]}case"TensorArrayScatterV3":{const s=l("tensorArrayId",e,t,n),r=l("indices",e,t,n),a=l("tensor",e,t,n),o=n.getTensorArray(s.id);return o.scatter(r,a),[o.idTensor]}case"TensorArrayConcatV3":{const s=l("tensorArrayId",e,t,n),r=n.getTensorArray(s.id),a=l("dtype",e,t,n);return[r.concat(a)]}case"TensorArraySplitV3":{const s=l("tensorArrayId",e,t,n),r=l("tensor",e,t,n),a=l("lengths",e,t,n),o=n.getTensorArray(s.id);return o.split(a,r),[o.idTensor]}case"TensorArraySizeV3":{const s=l("tensorArrayId",e,t,n),r=n.getTensorArray(s.id);return[U(r.size(),"int32")]}case"TensorArrayCloseV3":{const s=l("tensorArrayId",e,t,n),r=n.getTensorArray(s.id);return r.clearAndClose(),[r.idTensor]}case"TensorListSetItem":{const s=l("tensorListId",e,t,n),r=l("index",e,t,n),a=l("tensor",e,t,n),o=n.getTensorList(s.id);return o.setItem(r,a),[o.idTensor]}case"TensorListGetItem":{const s=l("tensorListId",e,t,n),r=l("index",e,t,n),a=l("elementShape",e,t,n),o=l("elementDType",e,t,n);return[n.getTensorList(s.id).getItem(r,a,o)]}case"TensorListScatterV2":case"TensorListScatter":{const s=l("indices",e,t,n),r=l("tensor",e,t,n),a=l("elementShape",e,t,n),o=l("numElements",e,t,n),i=Pw(r,s,a,o);return n.addTensorList(i),[i.idTensor]}case"TensorListReserve":case"EmptyTensorList":{const s=l("elementShape",e,t,n),r=l("elementDType",e,t,n);let a;e.op==="TensorListReserve"?a="numElements":a="maxNumElements";const o=l(a,e,t,n),i=e.op==="TensorListReserve"?-1:o,u=Lw(s,r,o,i);return n.addTensorList(u),[u.idTensor]}case"TensorListGather":{const s=l("tensorListId",e,t,n),r=l("indices",e,t,n),a=l("elementShape",e,t,n),o=l("elementDType",e,t,n);return[n.getTensorList(s.id).gather(r,o,a)]}case"TensorListStack":{const s=l("tensorListId",e,t,n),r=l("elementShape",e,t,n),a=l("elementDType",e,t,n),o=l("numElements",e,t,n);return[n.getTensorList(s.id).stack(r,a,o)]}case"TensorListFromTensor":{const s=l("tensor",e,t,n),r=l("elementShape",e,t,n),a=l("elementDType",e,t,n),o=Bw(s,r,a);return n.addTensorList(o),[o.idTensor]}case"TensorListConcat":case"TensorListConcatV2":{const s=l("tensorListId",e,t,n),r=n.getTensorList(s.id),a=l("dtype",e,t,n),o=l("elementShape",e,t,n);return[r.concat(a,o)]}case"TensorListPushBack":{const s=l("tensorListId",e,t,n),r=l("tensor",e,t,n),a=n.getTensorList(s.id);return a.pushBack(r),[a.idTensor]}case"TensorListPopBack":{const s=l("tensorListId",e,t,n),r=l("elementShape",e,t,n),a=l("elementDType",e,t,n);return[n.getTensorList(s.id).popBack(r,a)]}case"TensorListSplit":{const s=l("tensor",e,t,n),r=l("elementShape",e,t,n),a=l("lengths",e,t,n),o=Rw(s,a,r);return n.addTensorList(o),[o.idTensor]}case"TensorListLength":{const s=l("tensorListId",e,t,n),r=n.getTensorList(s.id);return[U(r.size(),"int32")]}case"TensorListResize":{const s=l("tensorListId",e,t,n),r=l("size",e,t,n),o=n.getTensorList(s.id).resize(r);return n.addTensorList(o),[o.idTensor]}default:throw TypeError(`Node type ${e.op} is not implemented`)}};/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Tr(e,t,n){const[s,r]=l("fusedOps",e,t,n),a=s==="biasadd",o=!a,i=r==="prelu",u=s==="fusedbatchnorm",c=l("numArgs",e,t,n);if(a){if(i&&c!==2)throw new Error("FusedConv2d and DepthwiseConv2d with BiasAdd and Prelu must have two extra arguments: bias and alpha.");if(!i&&a&&c!==1)throw new Error("FusedConv2d and DepthwiseConv2d with BiasAdd must have one extra argument: bias.")}if(u)throw new Error("FusedConv2d and DepthwiseConv2d with FusedBatchNorm is not supported");const h=l("strides",e,t,n),p=tn(e,t,n),f=l("dataFormat",e,t,n).toUpperCase(),d=l("dilations",e,t,n);let[w,T]=l("args",e,t,n);o&&(T=w,w=void 0);const S=l("leakyreluAlpha",e,t,n);return{stride:h,pad:p,dataFormat:f,dilations:d,biasArg:w,preluArg:T,activationFunc:r,leakyreluAlpha:S}}const Vw=(e,t,n,s=ot)=>{switch(e.op){case"Conv1D":{const r=l("stride",e,t,n),a=l("pad",e,t,n),o=l("dataFormat",e,t,n).toUpperCase(),i=l("dilation",e,t,n);return[s.conv1d(l("x",e,t,n),l("filter",e,t,n),r,a,o,i)]}case"Conv2D":{const r=l("strides",e,t,n),a=tn(e,t,n),o=l("dataFormat",e,t,n).toUpperCase(),i=l("dilations",e,t,n);return[s.conv2d(l("x",e,t,n),l("filter",e,t,n),[r[1],r[2]],a,o,[i[1],i[2]])]}case"_FusedConv2D":{const{stride:r,pad:a,dataFormat:o,dilations:i,biasArg:u,preluArg:c,activationFunc:h,leakyreluAlpha:p}=Tr(e,t,n);return[s.fused.conv2d({x:l("x",e,t,n),filter:l("filter",e,t,n),strides:[r[1],r[2]],pad:a,dataFormat:o,dilations:[i[1],i[2]],bias:u,activation:h,preluActivationWeights:c,leakyreluAlpha:p})]}case"FusedDepthwiseConv2dNative":{const{stride:r,pad:a,dataFormat:o,dilations:i,biasArg:u,preluArg:c,activationFunc:h,leakyreluAlpha:p}=Tr(e,t,n);return[s.fused.depthwiseConv2d({x:l("x",e,t,n),filter:l("filter",e,t,n),strides:[r[1],r[2]],pad:a,dataFormat:o,dilations:[i[1],i[2]],bias:u,activation:h,preluActivationWeights:c,leakyreluAlpha:p})]}case"Conv2DBackpropInput":case"Conv2dTranspose":{const r=l("outputShape",e,t,n),a=l("strides",e,t,n),o=tn(e,t,n);return[s.conv2dTranspose(l("x",e,t,n),l("filter",e,t,n),r,[a[1],a[2]],o)]}case"DepthwiseConv2dNative":case"DepthwiseConv2d":{const r=l("strides",e,t,n),a=tn(e,t,n),o=l("dilations",e,t,n),i=l("dataFormat",e,t,n).toUpperCase();return[s.depthwiseConv2d(l("input",e,t,n),l("filter",e,t,n),[r[1],r[2]],a,i,[o[1],o[2]])]}case"Conv3D":{const r=l("strides",e,t,n),a=l("pad",e,t,n),o=l("dataFormat",e,t,n).toUpperCase(),i=l("dilations",e,t,n);return[s.conv3d(l("x",e,t,n),l("filter",e,t,n),[r[1],r[2],r[3]],a,o,[i[1],i[2],i[3]])]}case"AvgPool":{const r=l("strides",e,t,n),a=l("pad",e,t,n),o=l("kernelSize",e,t,n);return[s.avgPool(l("x",e,t,n),[o[1],o[2]],[r[1],r[2]],a)]}case"MaxPool":{const r=l("strides",e,t,n),a=l("pad",e,t,n),o=l("kernelSize",e,t,n);return[s.maxPool(l("x",e,t,n),[o[1],o[2]],[r[1],r[2]],a)]}case"MaxPoolWithArgmax":{const r=l("strides",e,t,n),a=l("pad",e,t,n),o=l("kernelSize",e,t,n),i=l("includeBatchInIndex",e,t,n),{result:u,indexes:c}=s.maxPoolWithArgmax(l("x",e,t,n),[o[1],o[2]],[r[1],r[2]],a,i);return[u,c]}case"AvgPool3D":{const r=l("strides",e,t,n),a=l("pad",e,t,n),o=l("kernelSize",e,t,n);return[s.avgPool3d(l("x",e,t,n),[o[1],o[2],o[3]],[r[1],r[2],r[3]],a)]}case"MaxPool3D":{const r=l("strides",e,t,n),a=l("pad",e,t,n),o=l("kernelSize",e,t,n);return[s.maxPool3d(l("x",e,t,n),[o[1],o[2],o[3]],[r[1],r[2],r[3]],a)]}case"Dilation2D":{const r=l("strides",e,t,n),a=l("pad",e,t,n),o=l("dilations",e,t,n),i=r[1],u=r[2],c=o[1],h=o[2];return[s.dilation2d(l("x",e,t,n),l("filter",e,t,n),[i,u],a,[c,h],"NHWC")]}default:throw TypeError(`Node type ${e.op} is not implemented`)}};/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */const qw=(e,t,n,s=ot)=>{switch(e.op){case"Fill":{const r=l("shape",e,t,n),a=l("dtype",e,t,n),o=l("value",e,t,n);return[s.fill(r,o,a)]}case"LinSpace":{const r=l("start",e,t,n),a=l("stop",e,t,n),o=l("num",e,t,n);return[s.linspace(r,a,o)]}case"Multinomial":{const r=l("logits",e,t,n),a=l("numSamples",e,t,n),o=l("seed",e,t,n);return[s.multinomial(r,a,o)]}case"OneHot":{const r=l("indices",e,t,n),a=l("depth",e,t,n),o=l("onValue",e,t,n),i=l("offValue",e,t,n),u=l("dtype",e,t,n);return[s.oneHot(r,a,o,i,u)]}case"Ones":return[s.ones(l("shape",e,t,n),l("dtype",e,t,n))];case"OnesLike":return[s.onesLike(l("x",e,t,n))];case"RandomStandardNormal":return[s.randomStandardNormal(l("shape",e,t,n),l("dtype",e,t,n),l("seed",e,t,n))];case"RandomUniform":return[s.randomUniform(l("shape",e,t,n),l("minval",e,t,n),l("maxval",e,t,n),l("dtype",e,t,n))];case"Range":{const r=l("start",e,t,n),a=l("stop",e,t,n),o=l("step",e,t,n);return[s.range(r,a,o,l("dtype",e,t,n))]}case"TruncatedNormal":{const r=l("shape",e,t,n),a=l("mean",e,t,n),o=l("stdDev",e,t,n),i=l("seed",e,t,n);return[s.truncatedNormal(r,a,o,l("dtype",e,t,n),i)]}case"Zeros":return[s.zeros(l("shape",e,t,n),l("dtype",e,t,n))];case"ZerosLike":return[s.zerosLike(l("x",e,t,n))];default:throw TypeError(`Node type ${e.op} is not implemented`)}};/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Ln(e,t,n){const s=l("boxes",e,t,n),r=l("scores",e,t,n),a=l("maxOutputSize",e,t,n),o=l("iouThreshold",e,t,n),i=l("scoreThreshold",e,t,n),u=l("softNmsSigma",e,t,n);return{boxes:s,scores:r,maxOutputSize:a,iouThreshold:o,scoreThreshold:i,softNmsSigma:u}}const Uw=async(e,t,n,s,r=ot)=>{switch(e.op){case"NonMaxSuppressionV5":{const{boxes:a,scores:o,maxOutputSize:i,iouThreshold:u,scoreThreshold:c,softNmsSigma:h}=Ln(e,t,n),p=await r.image.nonMaxSuppressionWithScoreAsync(a,o,i,u,c,h);return[p.selectedIndices,p.selectedScores]}case"NonMaxSuppressionV4":{const{boxes:a,scores:o,maxOutputSize:i,iouThreshold:u,scoreThreshold:c}=Ln(e,t,n),h=l("padToMaxOutputSize",e,t,n),p=await r.image.nonMaxSuppressionPaddedAsync(a,o,i,u,c,h);return[p.selectedIndices,p.validOutputs]}case"NonMaxSuppressionV3":case"NonMaxSuppressionV2":{const{boxes:a,scores:o,maxOutputSize:i,iouThreshold:u,scoreThreshold:c}=Ln(e,t,n);return[await r.image.nonMaxSuppressionAsync(a,o,i,u,c)]}case"Where":{const a=r.cast(l("condition",e,t,n),"bool"),o=[await r.whereAsync(a)];return a.dispose(),o}case"ListDiff":return r.setdiff1dAsync(l("x",e,t,n),l("y",e,t,n));default:throw TypeError(`Node type ${e.op} is not implemented`)}};/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */const Ww=(e,t,n,s=ot)=>{switch(e.op){case"LowerBound":{const r=l("sortedSequence",e,t,n),a=l("values",e,t,n);return[s.lowerBound(r,a)]}case"TopKV2":{const r=l("x",e,t,n),a=l("k",e,t,n),o=l("sorted",e,t,n),i=s.topk(r,a,o);return[i.values,i.indices]}case"UpperBound":{const r=l("sortedSequence",e,t,n),a=l("values",e,t,n);return[s.upperBound(r,a)]}case"Unique":{const r=l("x",e,t,n),a=s.unique(r);return[a.values,a.indices]}case"UniqueV2":{const r=l("x",e,t,n),a=l("axis",e,t,n),o=s.unique(r,a);return[o.values,o.indices]}default:throw TypeError(`Node type ${e.op} is not implemented`)}};/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */const jw=(e,t,n,s=ot)=>{switch(e.op){case"Const":return t[e.name];case"PlaceholderWithDefault":const r=l("default",e,t,n);return[ct(e.name,t,n)||r];case"Placeholder":return[ct(e.name,t,n)];case"Identity":case"StopGradient":case"FakeQuantWithMinMaxVars":{const h=l("x",e,t,n);return[It(h)]}case"IdentityN":return l("x",e,t,n).map(h=>It(h));case"Snapshot":const a=l("x",e,t,n);return[It(a)];case"Shape":return[s.tensor1d(l("x",e,t,n).shape,"int32")];case"ShapeN":return l("x",e,t,n).map(h=>s.tensor1d(h.shape));case"Size":return[s.scalar(l("x",e,t,n).size,"int32")];case"Rank":return[s.scalar(l("x",e,t,n).rank,"int32")];case"NoOp":return[s.scalar(1)];case"Print":const o=l("x",e,t,n),i=l("data",e,t,n),u=l("message",e,t,n),c=l("summarize",e,t,n);console.warn("The graph has a tf.print() operation,usually used for debugging, which slows down performance."),console.log(u);for(let h=0;h<i.length;h++)console.log(Array.prototype.slice.call(i[h].dataSync()).slice(0,c));return[o];default:throw TypeError(`Node type ${e.op} is not implemented`)}};/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */class Kw{constructor(t,n){this.keyDType=t,this.valueDType=n,this.handle=U(0),this.tensorMap=new Map,Rt(this.handle)}get id(){return this.handle.id}clearAndClose(){this.tensorMap.forEach(t=>t.dispose()),this.tensorMap.clear(),this.handle.dispose()}size(){return this.tensorMap.size}tensorSize(){return U(this.size(),"int32")}async import(t,n){this.checkKeyAndValueTensor(t,n);const s=await t.data();return this.tensorMap.forEach(r=>r.dispose()),this.tensorMap.clear(),kt(()=>{const r=ue(n),a=s.length,o=r.length;y(a===o,()=>`The number of elements doesn't match, keys has ${a} elements, the values has ${o} elements.`);for(let i=0;i<a;i++){const u=s[i],c=r[i];Rt(c),this.tensorMap.set(u,c)}return this.handle})}async find(t,n){this.checkKeyAndValueTensor(t,n);const s=await t.data();return kt(()=>{const r=[];for(let a=0;a<s.length;a++){const o=s[a],i=this.findWithDefault(o,n);r.push(i)}return Bt(r)})}findWithDefault(t,n){const s=this.tensorMap.get(t);return s??n}checkKeyAndValueTensor(t,n){if(t.dtype!==this.keyDType)throw new Error(`Expect key dtype ${this.keyDType}, but got ${t.dtype}`);if(n.dtype!==this.valueDType)throw new Error(`Expect value dtype ${this.valueDType}, but got ${n.dtype}`)}}/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */const Hw=async(e,t,n,s)=>{switch(e.op){case"HashTable":case"HashTableV2":{const r=l("keyDType",e,t,n),a=l("valueDType",e,t,n),o=new Kw(r,a);return s.addHashTable(e.name,o),[o.handle]}case"LookupTableImport":case"LookupTableImportV2":{const r=l("tableHandle",e,t,n,s),a=l("keys",e,t,n),o=l("values",e,t,n);return[await s.getHashTableById(r.id).import(a,o)]}case"LookupTableFind":case"LookupTableFindV2":{const r=l("tableHandle",e,t,n,s),a=l("keys",e,t,n),o=l("defaultValue",e,t,n);return[await s.getHashTableById(r.id).find(a,o)]}case"LookupTableSize":case"LookupTableSizeV2":{const r=l("tableHandle",e,t,n,s);return[s.getHashTableById(r.id).tensorSize()]}default:throw TypeError(`Node type ${e.op} is not implemented`)}};/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */const Gw=(e,t,n,s=ot)=>{switch(e.op){case"ResizeBilinear":{const r=l("images",e,t,n),a=l("size",e,t,n),o=l("alignCorners",e,t,n),i=l("halfPixelCenters",e,t,n);return[s.image.resizeBilinear(r,[a[0],a[1]],o,i)]}case"ResizeNearestNeighbor":{const r=l("images",e,t,n),a=l("size",e,t,n),o=l("alignCorners",e,t,n),i=l("halfPixelCenters",e,t,n);return[s.image.resizeNearestNeighbor(r,[a[0],a[1]],o,i)]}case"CropAndResize":{const r=l("image",e,t,n),a=l("boxes",e,t,n),o=l("boxInd",e,t,n),i=l("cropSize",e,t,n),u=l("method",e,t,n),c=l("extrapolationValue",e,t,n);return[s.image.cropAndResize(r,a,o,i,u,c)]}case"ImageProjectiveTransformV3":{const r=l("images",e,t,n),a=l("transforms",e,t,n),o=l("outputShape",e,t,n),i=l("fillValue",e,t,n),u=l("interpolation",e,t,n),c=l("fillMode",e,t,n);return[s.image.transform(r,a,u.toLowerCase(),c.toLowerCase(),i,o)]}default:throw TypeError(`Node type ${e.op} is not implemented`)}};/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */const Mw=(e,t,n,s=ot)=>{switch(e.op){case"Equal":return[s.equal(l("a",e,t,n),l("b",e,t,n))];case"NotEqual":return[s.notEqual(l("a",e,t,n),l("b",e,t,n))];case"Greater":return[s.greater(l("a",e,t,n),l("b",e,t,n))];case"GreaterEqual":return[s.greaterEqual(l("a",e,t,n),l("b",e,t,n))];case"Less":return[s.less(l("a",e,t,n),l("b",e,t,n))];case"LessEqual":return[s.lessEqual(l("a",e,t,n),l("b",e,t,n))];case"LogicalAnd":return[s.logicalAnd(l("a",e,t,n),l("b",e,t,n))];case"LogicalNot":return[s.logicalNot(l("a",e,t,n))];case"LogicalOr":return[s.logicalOr(l("a",e,t,n),l("b",e,t,n))];case"Select":case"SelectV2":return[s.where(l("condition",e,t,n),l("a",e,t,n),l("b",e,t,n))];default:throw TypeError(`Node type ${e.op} is not implemented`)}};/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */const Xw=(e,t,n,s=ot)=>{switch(e.op){case"BatchMatMul":case"BatchMatMulV2":case"MatMul":return[s.matMul(l("a",e,t,n),l("b",e,t,n),l("transposeA",e,t,n),l("transposeB",e,t,n))];case"Einsum":return[s.einsum(l("equation",e,t,n),...l("tensors",e,t,n))];case"Transpose":return[s.transpose(l("x",e,t,n),l("perm",e,t,n))];case"_FusedMatMul":const[r,a]=l("fusedOps",e,t,n),o=r==="biasadd",i=a==="prelu",u=l("numArgs",e,t,n),c=l("leakyreluAlpha",e,t,n);if(o){if(i&&u!==2)throw new Error("Fused MatMul with BiasAdd and Prelu must have two extra arguments: bias and alpha.");if(!i&&u!==1)throw new Error("Fused MatMul with BiasAdd must have one extra argument: bias.")}const[h,p]=l("args",e,t,n);return[s.fused.matMul({a:l("a",e,t,n),b:l("b",e,t,n),transposeA:l("transposeA",e,t,n),transposeB:l("transposeB",e,t,n),bias:h,activation:a,preluActivationWeights:p,leakyreluAlpha:c})];default:throw TypeError(`Node type ${e.op} is not implemented`)}};/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */const Yw=(e,t,n,s=ot)=>{switch(e.op){case"EuclideanNorm":return[s.euclideanNorm(l("x",e,t,n),l("axis",e,t,n),l("keepDims",e,t,n))];case"FusedBatchNorm":case"FusedBatchNormV2":return[s.batchNorm(l("x",e,t,n),l("mean",e,t,n),l("variance",e,t,n),l("offset",e,t,n),l("scale",e,t,n),l("epsilon",e,t,n))];case"FusedBatchNormV3":return[s.batchNorm(l("x",e,t,n),l("mean",e,t,n),l("variance",e,t,n),l("offset",e,t,n),l("scale",e,t,n),l("epsilon",e,t,n))];case"LRN":return[s.localResponseNormalization(l("x",e,t,n),l("radius",e,t,n),l("bias",e,t,n),l("alpha",e,t,n),l("beta",e,t,n))];case"Softmax":return[s.softmax(l("x",e,t,n))];case"LogSoftmax":return[s.logSoftmax(l("x",e,t,n))];case"SparseToDense":return[s.sparseToDense(l("sparseIndices",e,t,n),l("outputShape",e,t,n),l("sparseValues",e,t,n),l("defaultValue",e,t,n))];default:throw TypeError(`Node type ${e.op} is not implemented`)}};/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */const Jw=(e,t,n,s=ot)=>{switch(e.op){case"Max":{const i=l("axis",e,t,n),u=l("keepDims",e,t,n);return[s.max(l("x",e,t,n),i,u)]}case"Mean":{const i=l("axis",e,t,n),u=l("keepDims",e,t,n);return[s.mean(l("x",e,t,n),i,u)]}case"Min":{const i=l("axis",e,t,n),u=l("keepDims",e,t,n);return[s.min(l("x",e,t,n),i,u)]}case"Sum":{const i=l("axis",e,t,n),u=l("keepDims",e,t,n);return[s.sum(l("x",e,t,n),i,u)]}case"All":{const i=l("axis",e,t,n),u=l("keepDims",e,t,n);return[s.all(l("x",e,t,n),i,u)]}case"Any":{const i=l("axis",e,t,n),u=l("keepDims",e,t,n);return[s.any(l("x",e,t,n),i,u)]}case"ArgMax":{const i=l("axis",e,t,n);return[s.argMax(l("x",e,t,n),i)]}case"ArgMin":{const i=l("axis",e,t,n);return[s.argMin(l("x",e,t,n),i)]}case"Prod":{const i=l("axis",e,t,n),u=l("keepDims",e,t,n);return[s.prod(l("x",e,t,n),i,u)]}case"Cumprod":{const i=l("axis",e,t,n),u=l("exclusive",e,t,n),c=l("reverse",e,t,n);return[s.cumprod(l("x",e,t,n),i,u,c)]}case"Cumsum":{const i=l("axis",e,t,n),u=l("exclusive",e,t,n),c=l("reverse",e,t,n);return[s.cumsum(l("x",e,t,n),i,u,c)]}case"Bincount":const r=l("x",e,t,n),a=l("weights",e,t,n),o=l("size",e,t,n);return[s.bincount(r,a,o)];case"DenseBincount":{const i=l("x",e,t,n),u=l("weights",e,t,n),c=l("size",e,t,n),h=l("binaryOutput",e,t,n);return[s.denseBincount(i,u,c,h)]}default:throw TypeError(`Node type ${e.op} is not implemented`)}};/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */const Zw=(e,t,n,s=ot)=>{switch(e.op){case"ConcatV2":case"Concat":{const r=l("n",e,t,n),a=l("axis",e,t,n);let o=l("tensors",e,t,n);return o=o.slice(0,r),[s.concat(o,a)]}case"Gather":{const r=l("x",e,t,n),a=l("indices",e,t,n);return[s.gather(r,s.cast(a,"int32"),0)]}case"GatherV2":{const r=l("axis",e,t,n),a=l("batchDims",e,t,n),o=l("x",e,t,n),i=l("indices",e,t,n);return[s.gather(o,s.cast(i,"int32"),r,a)]}case"Reverse":{const r=l("dims",e,t,n),a=[];for(let i=0;i<r.length;i++)r[i]&&a.push(i);const o=l("x",e,t,n);return[s.reverse(o,a)]}case"ReverseV2":{const r=l("axis",e,t,n),a=l("x",e,t,n);return[s.reverse(a,r)]}case"Slice":{const r=l("begin",e,t,n),a=l("size",e,t,n);return[s.slice(l("x",e,t,n),r,a)]}case"StridedSlice":{const r=l("begin",e,t,n),a=l("end",e,t,n),o=l("strides",e,t,n),i=l("beginMask",e,t,n),u=l("endMask",e,t,n),c=l("ellipsisMask",e,t,n),h=l("newAxisMask",e,t,n),p=l("shrinkAxisMask",e,t,n),f=l("x",e,t,n);return[s.stridedSlice(f,r,a,o,i,u,c,h,p)]}case"Pack":return kt(()=>{const r=l("axis",e,t,n),a=l("tensors",e,t,n),o=a[0].shape,i=s.squeeze(a[0]).shape,u=a.map(c=>{const h=Ot(c.shape,o);if(!h&&!Ot(s.squeeze(c).shape,i))throw new Error("the input tensors shape does not match");return h?c:s.reshape(c,o)});return[s.stack(u,r)]});case"Unpack":{const r=l("axis",e,t,n),a=l("tensor",e,t,n);return s.unstack(a,r)}case"Tile":{const r=l("reps",e,t,n);return[s.tile(l("x",e,t,n),r)]}case"Split":case"SplitV":{const r=l("axis",e,t,n),a=l("numOrSizeSplits",e,t,n),o=l("x",e,t,n);return s.split(o,a,r)}case"ScatterNd":{const r=l("indices",e,t,n),a=l("values",e,t,n),o=l("shape",e,t,n);return[s.scatterND(r,a,o)]}case"GatherNd":{const r=l("x",e,t,n),a=l("indices",e,t,n);return[s.gatherND(r,a)]}case"SparseToDense":{const r=l("sparseIndices",e,t,n),a=l("outputShape",e,t,n),o=l("sparseValues",e,t,n),i=l("defaultValue",e,t,n);return[s.sparseToDense(r,o,a,o.dtype===i.dtype?i:s.cast(i,o.dtype))]}default:throw TypeError(`Node type ${e.op} is not implemented`)}};/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */const Qw=(e,t,n,s=ot)=>{switch(e.op){case"SparseFillEmptyRows":{const{outputIndices:r,outputValues:a,emptyRowIndicator:o,reverseIndexMap:i}=s.sparse.sparseFillEmptyRows(l("indices",e,t,n),l("values",e,t,n),l("denseShape",e,t,n),l("defaultValue",e,t,n));return[r,a,o,i]}case"SparseReshape":{const{outputIndices:r,outputShape:a}=s.sparse.sparseReshape(l("inputIndices",e,t,n),l("inputShape",e,t,n),l("newShape",e,t,n));return[r,a]}case"SparseSegmentMean":return[s.sparse.sparseSegmentMean(l("data",e,t,n),l("indices",e,t,n),l("segmentIds",e,t,n))];case"SparseSegmentSum":return[s.sparse.sparseSegmentSum(l("data",e,t,n),l("indices",e,t,n),l("segmentIds",e,t,n))];default:throw TypeError(`Node type ${e.op} is not implemented`)}};/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */const t0=(e,t,n,s=ot)=>{switch(e.op){case"FFT":return[s.fft(l("x",e,t,n))];case"IFFT":return[s.ifft(l("x",e,t,n))];case"RFFT":return[s.rfft(l("x",e,t,n))];case"IRFFT":return[s.irfft(l("x",e,t,n))];default:throw TypeError(`Node type ${e.op} is not implemented`)}};/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */const e0=(e,t,n,s=ot)=>{switch(e.op){case"StringNGrams":{const{nGrams:r,nGramsSplits:a}=s.string.stringNGrams(l("data",e,t,n),l("dataSplits",e,t,n),l("separator",e,t,n),l("nGramWidths",e,t,n),l("leftPad",e,t,n),l("rightPad",e,t,n),l("padWidth",e,t,n),l("preserveShortSequences",e,t,n));return[r,a]}case"StringSplit":{const{indices:r,values:a,shape:o}=s.string.stringSplit(l("input",e,t,n),l("delimiter",e,t,n),l("skipEmpty",e,t,n));return[r,a,o]}case"StringToHashBucketFast":return[s.string.stringToHashBucketFast(l("input",e,t,n),l("numBuckets",e,t,n))];default:throw TypeError(`Node type ${e.op} is not implemented`)}};/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */const n0=(e,t,n,s=ot)=>{switch(e.op){case"Cast":return[s.cast(l("x",e,t,n),l("dtype",e,t,n))];case"ExpandDims":{const r=l("axis",e,t,n);return[s.expandDims(l("x",e,t,n),r)]}case"Squeeze":{const r=l("axis",e,t,n);return[s.squeeze(l("x",e,t,n),r)]}case"Reshape":return[s.reshape(l("x",e,t,n),l("shape",e,t,n))];case"MirrorPad":return[s.mirrorPad(l("x",e,t,n),l("padding",e,t,n),l("mode",e,t,n))];case"PadV2":case"Pad":return[s.pad(l("x",e,t,n),l("padding",e,t,n),l("constantValue",e,t,n))];case"SpaceToBatchND":{const r=l("blockShape",e,t,n),a=l("paddings",e,t,n);return[s.spaceToBatchND(l("x",e,t,n),r,a)]}case"BatchToSpaceND":{const r=l("blockShape",e,t,n),a=l("crops",e,t,n);return[s.batchToSpaceND(l("x",e,t,n),r,a)]}case"DepthToSpace":{const r=l("blockSize",e,t,n),a=l("dataFormat",e,t,n).toUpperCase();return[s.depthToSpace(l("x",e,t,n),r,a)]}case"BroadcastTo":return[s.broadcastTo(l("x",e,t,n),l("shape",e,t,n))];case"BroadcastArgs":return[s.broadcastArgs(l("s0",e,t,n),l("s1",e,t,n))];default:throw TypeError(`Node type ${e.op} is not implemented`)}};/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function Sr(e,t,n,s,r=kt){const a=((o,i,u)=>{switch(o.category){case"arithmetic":return r(()=>Ow(o,i,u));case"basic_math":return r(()=>Fw(o,i,u));case"control":return zw(o,i,u);case"convolution":return r(()=>Vw(o,i,u));case"creation":return r(()=>qw(o,i,u));case"dynamic":return Uw(o,i,u);case"evaluation":return r(()=>Ww(o,i,u));case"image":return r(()=>Gw(o,i,u));case"graph":return r(()=>jw(o,i,u));case"logical":return r(()=>Mw(o,i,u));case"matrices":return r(()=>Xw(o,i,u));case"normalization":return r(()=>Yw(o,i,u));case"reduction":return r(()=>Jw(o,i,u));case"slice_join":return r(()=>Zw(o,i,u));case"sparse":return r(()=>Qw(o,i,u));case"spectral":return r(()=>t0(o,i,u));case"string":return r(()=>e0(o,i,u));case"transformation":return r(()=>n0(o,i,u));case"hash_table":return Hw(o,i,u,s);case"custom":const c=Qa(o.op);if(c&&c.customExecutor)return c.customExecutor(new Dw(o,i,u));throw TypeError(`Custom op ${o.op} is not registered.`);default:throw TypeError(`Unknown op '${o.op}'. File an issue at https://github.com/tensorflow/tfjs/issues so we can add it, or register a custom execution with tf.registerOp()`)}})(e,t,n);return te(a)?a.then(o=>[].concat(o)):[].concat(a)}class $r{constructor(t={},n={},s={},r={}){this.weightMap=t,this.tensorArrayMap=n,this.tensorListMap=s,this.functionMap=r,this.rootContext={id:0,frameName:"",iterationId:0},this.contexts=[this.rootContext],this.lastId=0,this.generateCurrentContextIds()}newFrame(t,n){return{id:t,frameName:n,iterationId:0}}set currentContext(t){this.contexts!==t&&(this.contexts=t,this.generateCurrentContextIds())}get currentContext(){return this.contexts}get currentContextId(){return this._currentContextIds[0]}get currentContextIds(){return this._currentContextIds}generateCurrentContextIds(){const t=[];for(let n=0;n<this.contexts.length-1;n++){const s=this.contexts.slice(0,this.contexts.length-n);t.push(this.contextIdforContexts(s))}t.push(""),this._currentContextIds=t}contextIdforContexts(t){return t?t.map(n=>n.id===0&&n.iterationId===0?"":`${n.frameName}-${n.iterationId}`).join("/"):""}enterFrame(t){this.contexts&&(this.lastId++,this.contexts=this.contexts.slice(),this.contexts.push(this.newFrame(this.lastId,t)),this._currentContextIds.unshift(this.contextIdforContexts(this.contexts)))}exitFrame(){if(this.contexts&&this.contexts.length>1)this.contexts=this.contexts.slice(),this.contexts.splice(-1),this.currentContextIds.shift();else throw new Error("Cannot exit frame, the context is empty")}nextIteration(){if(this.contexts&&this.contexts.length>0){this.contexts=this.contexts.slice(),this.lastId++;const t=Object.assign({},this.contexts[this.contexts.length-1]);t.iterationId+=1,t.id=this.lastId,this.contexts.splice(-1,1,t),this._currentContextIds.splice(0,1,this.contextIdforContexts(this.contexts))}else throw new Error("Cannot increase frame iteration, the context is empty")}getWeight(t){return this.weightMap[t]}addTensorArray(t){this.tensorArrayMap[t.id]=t}getTensorArray(t){return this.tensorArrayMap[t]}addTensorList(t){this.tensorListMap[t.id]=t}getTensorList(t){return this.tensorListMap[t]}dispose(t){for(const n in this.tensorArrayMap)this.tensorArrayMap[n].clearAndClose(t);for(const n in this.tensorListMap)this.tensorListMap[n].clearAndClose(t)}}/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */function kr(e,t,n,s){const r=new Set,a=[];let o=null,i=null;const u=new Set,c=Object.keys(e).map(f=>mt(f)[0]);let h=[];s!=null&&(h=s.map(f=>mt(f.name)[0]));const p=[...t];for(;p.length>0;){const f=p.pop();if((no(f)||i0(f)||u0(f))&&o==null&&(o=f,i=o.children.map(d=>d.name).filter(d=>r.has(d))),r.add(f.name),n[f.name]==null&&c.indexOf(f.name)===-1&&h.indexOf(f.name)===-1){if(f.inputs.length===0){a.push(f.name);continue}f.inputs.forEach(d=>{u.has(d.name)||(u.add(d.name),p.push(d))})}}return{inputs:e,outputs:t,usedNodes:r,missingInputs:a,dynamicNode:o,syncInputs:i}}function s0(e,t,n){const{usedNodes:s,inputs:r}=n,a=[],o=Object.keys(r).map(h=>mt(h)[0]).map(h=>e.nodes[h]),i=e.initNodes;o.forEach(h=>{s.has(h.name)&&a.push(h)}),e.weights.forEach(h=>{s.has(h.name)&&a.push(h)}),i!=null&&i.forEach(h=>{s.has(h.name)&&a.push(h)});const u=new Set,c=[];for(;a.length>0;){const h=a.pop();u.add(h.name),t[h.name]||c.push(h),h.children.forEach(p=>{!u.has(p.name)&&s.has(p.name)&&p.inputs.every(f=>u.has(f.name))&&a.push(p)})}return c}const r0=["Switch","Merge","Enter","Exit","NextIteration","StatelessIf","StatelessWhile","if","While"],a0=["NonMaxSuppressionV2","NonMaxSuppressionV3","NonMaxSuppressionV5","Where"],o0=["HashTable","HashTableV2","LookupTableImport","LookupTableImportV2","LookupTableFind","LookupTableFindV2","LookupTableSize","LookupTableSizeV2"];function no(e){return r0.indexOf(e.op)>=0}function i0(e){return a0.indexOf(e.op)>=0}function u0(e){return o0.indexOf(e.op)>=0}/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */class hn{constructor(t,n){this.graph=t,this.parent=n,this.compiledMap=new Map,this._weightMap={},this.SEPERATOR=",",this._functions={},this._functionExecutorMap={},this.intermediateTensors={},this.keepTensorForDebug=!1,this._outputs=t.outputs,this._inputs=t.inputs,this._initNodes=t.initNodes,this._signature=t.signature,this._functions=t.functions,t.functions!=null&&Object.keys(t.functions).forEach(s=>{this._functionExecutorMap[s]=new hn(t.functions[s],this)})}get weightIds(){return this.parent?this.parent.weightIds:this._weightIds}get functionExecutorMap(){return this.parent?this.parent.functionExecutorMap:this._functionExecutorMap}get weightMap(){return this.parent?this.parent.weightMap:this._weightMap}set weightMap(t){const n=Object.keys(t).map(s=>t[s].map(r=>r.id));this._weightIds=[].concat(...n),this._weightMap=t}set resourceManager(t){this._resourceManager=t}get inputs(){return this._inputs.map(t=>({name:t.name,shape:t.attrParams.shape?t.attrParams.shape.value:void 0,dtype:t.attrParams.dtype?t.attrParams.dtype.value:void 0}))}get outputs(){return this._outputs.map(t=>({name:t.name,shape:t.attrParams.shape?t.attrParams.shape.value:void 0,dtype:t.attrParams.dtype?t.attrParams.dtype.value:void 0}))}get inputNodes(){return this._inputs.map(t=>t.signatureKey||t.name)}get outputNodes(){return this._outputs.map(t=>{const n=t.signatureKey||t.name;return t.defaultOutput?`${n}:${t.defaultOutput}`:n})}get functions(){return Object.keys(this._functions).reduce((t,n)=>(t[n]=this._functions[n].signature,t),{})}getCompilationKey(t,n){const s=t.map(a=>a.name).sort(),r=n.map(a=>a.name).sort();return s.join(this.SEPERATOR)+"--"+r.join(this.SEPERATOR)}compile(t,n){const s=kr(t,n,this.weightMap,this._initNodes),{missingInputs:r,dynamicNode:a,syncInputs:o}=s;if(a!=null)throw new Error(`This execution contains the node '${a.name}', which has the dynamic op '${a.op}'. Please use model.executeAsync() instead. Alternatively, to avoid the dynamic ops, specify the inputs [${o}]`);if(r.length>0){const i=n.map(c=>c.name),u=Object.keys(t);throw new Error(`Cannot compute the outputs [${i}] from the provided inputs [${u}]. Missing the following inputs: [${r}]`)}return s0(this.graph,this.weightMap,s)}execute(t,n){t=this.mapInputs(t);const s=Object.keys(t).sort();this.checkInputs(t),this.checkInputShapeAndType(t),n=this.mapOutputs(n),this.checkOutputs(n);const r=s.map(p=>this.graph.nodes[mt(p)[0]]),a=n.map(p=>mt(p)[0]);let o=a.map(p=>this.graph.nodes[p]);this.resetIntermediateTensors(),o.length===0&&(o=this._outputs);const i=this.getCompilationKey(r,o);let u=this.compiledMap.get(i);u==null&&(u=this.compile(t,o),this.compiledMap.set(i,u));const c={},h={};return kt(()=>{const p=new $r(this.weightMap,c,h,this.functionExecutorMap),f=Object.assign({},this.weightMap);Object.keys(t).forEach(T=>{const[S,$]=mt(T),O=[];O[$]=t[T],f[S]=O});const d=this.getFrozenTensorIds(f),w={};for(let T=0;T<u.length;T++){const S=u[T];if(!f[S.name]){const $=Sr(S,f,p,this._resourceManager);if(te($))throw new Error(`The execution of the op '${S.op}' returned a promise. Please use model.executeAsync() instead.`);f[S.name]=$,this.checkTensorForDisposal(S.name,S,f,p,d,a,w)}}return this.parent==null&&p.dispose(d),n.map(T=>ct(T,f,p))})}getFrozenTensorIds(t){const n=[].concat.apply([],Object.keys(t).map(s=>t[s]).map(s=>s.map(r=>r.id)));return new Set(n)}checkTensorForDisposal(t,n,s,r,a,o,i){n.category==="control"||o.indexOf(t)!==-1||(s[t].forEach(u=>{u!=null&&(i[u.id]=(i[u.id]||0)+n.children.length)}),n.inputs.forEach(u=>{if(u.category!=="control"){const c=Kb(u.name,s,r);c!=null&&c.forEach(h=>{if(h&&!h.kept&&!a.has(h.id)){const p=i[h.id];if(p===1){if(!this.keepTensorForDebug)h.dispose();else{const[f,d]=_t(n.name,r);this.intermediateTensors[f]?this.intermediateTensors[f][d]=h:(this.intermediateTensors[f]=[],this.intermediateTensors[f][d]=h)}delete i[h.id]}else p!=null&&i[h.id]--}})}}))}async executeAsync(t,n){return this._executeAsync(t,n)}disposeIntermediateTensors(){this.intermediateTensors&&(Object.keys(this.intermediateTensors).forEach(t=>this.intermediateTensors[t].forEach(n=>n.dispose())),this.disposeTensorsMap())}disposeTensorsMap(){this.tensorsMap&&Object.keys(this.tensorsMap).forEach(t=>{this.tensorsMap[t].forEach(s=>{s&&!s.kept&&!s.isDisposed&&!this.keepIds.has(s.id)&&s.dispose()})})}getIntermediateTensors(){return this.tensorsMap}resetIntermediateTensors(){for(const t in this.intermediateTensors)this.intermediateTensors[t].forEach(n=>n.dispose()),delete this.intermediateTensors[t]}async _executeAsync(t,n,s=!1,r={},a={}){s||(t=this.mapInputs(t),this.checkInputs(t),this.checkInputShapeAndType(t),n=this.mapOutputs(n),this.checkOutputs(n));try{this.keepTensorForDebug=R().getBool("KEEP_INTERMEDIATE_TENSORS")}catch(h){console.warn(h.message)}this.resetIntermediateTensors();const o=new $r(this.weightMap,r,a,this.functionExecutorMap);this.tensorsMap=await this.executeWithControlFlow(t,o,n,s);const i=n.map(h=>ct(h,this.tensorsMap,o)),u=i.map(h=>h.id),c=Object.keys(t).map(h=>t[h].id);return this.keepIds=new Set([...u,...c,...this.weightIds]),this.keepTensorForDebug||this.disposeTensorsMap(),this.parent==null&&o.dispose(this.keepIds),i}async executeFunctionAsync(t,n,s){const r=t.reduce((a,o,i)=>(a[this.inputs[i].name]=o,a),{});return this._executeAsync(r,this.outputNodes,!0,n,s)}async executeWithControlFlow(t,n,s,r){const a=Object.keys(t),o=a.map(I=>this.graph.nodes[mt(I)[0]]),i=s.map(I=>mt(I)[0]);let u=i.map(I=>this.graph.nodes[I]);u.length===0&&(u=this._outputs);const{usedNodes:c,missingInputs:h,dynamicNode:p,syncInputs:f}=kr(t,u,this.weightMap,this._initNodes),d=[...o,...this.graph.weights,...this._initNodes||[]].map(I=>({node:I,contexts:n.currentContext})),w=Object.assign({},this.weightMap);Object.keys(t).forEach(I=>{const[_,A]=mt(I),D=[];D[A]=t[I],w[_]=D});const T={},S=this.getFrozenTensorIds(w),$={};for(;d.length>0;){const I=this.processStack(o,d,n,w,$,S,i,T,c);await Promise.all(I)}p==null&&!r&&console.warn("This model execution did not contain any nodes with control flow or dynamic output shapes. You can use model.execute() instead.");const O=u.filter(I=>!no(I)&&!ct(I.name,w,n)).map(I=>I.name);if(O.length>0){let I="";throw p!=null&&(I=`Alternatively, to avoid the dynamic ops, use model.execute() and specify the inputs [${f}]`),new Error(`Cannot compute the outputs [${O}] from the provided inputs [${a}]. Consider providing the following inputs: [${h}]. ${I}`)}return w}processStack(t,n,s,r,a,o,i,u,c){const h=[];for(;n.length>0;){const p=n.pop();s.currentContext=p.contexts;let f="";if(p.node.op==="Enter"&&l("isConstant",p.node,r,s)&&([f]=_t(p.node.name,s)),r[p.node.name]==null){const d=Sr(p.node,r,s,this._resourceManager);f||([f]=_t(p.node.name,s));const w=s.currentContext;te(d)?h.push(d.then(T=>(r[f]=T,s.currentContext=w,this.checkTensorForDisposal(f,p.node,r,s,o,i,u),this.processChildNodes(p.node,n,s,r,a,c),T))):(r[f]=d,this.checkTensorForDisposal(f,p.node,r,s,o,i,u),this.processChildNodes(p.node,n,s,r,a,c))}else this.processChildNodes(p.node,n,s,r,a,c)}return h}processChildNodes(t,n,s,r,a,o){t.children.forEach(i=>{const[u]=_t(i.name,s);a[u]||!o.has(i.name)||(i.op==="Merge"?i.inputNames.some(c=>!!ct(c,r,s))&&(a[u]=!0,n.push({contexts:s.currentContext,node:i})):i.inputNames.every(c=>!!ct(c,r,s))&&(a[u]=!0,n.push({contexts:s.currentContext,node:i})))})}dispose(){Object.keys(this.weightMap).forEach(t=>this.weightMap[t].forEach(n=>n.dispose()))}checkInputShapeAndType(t){Object.keys(t).forEach(n=>{const s=t[n],[r]=mt(n),a=this.graph.nodes[r];if(a.attrParams.shape&&a.attrParams.shape.value){const o=a.attrParams.shape.value,i=o.length===s.shape.length&&s.shape.every((u,c)=>o[c]===-1||o[c]===u);y(i,()=>`The shape of dict['${a.name}'] provided in model.execute(dict) must be [${o}], but was [${s.shape}]`)}a.attrParams.dtype&&a.attrParams.dtype.value&&y(s.dtype===a.attrParams.dtype.value,()=>`The dtype of dict['${a.name}'] provided in model.execute(dict) must be ${a.attrParams.dtype.value}, but was ${s.dtype}`)})}mapInputs(t){const n={};for(const s in t)if(this._signature!=null&&this._signature.inputs!=null&&this._signature.inputs[s]!=null){const r=this._signature.inputs[s];n[r.name]=t[s]}else n[s]=t[s];return n}checkInputs(t){const n=Object.keys(t).filter(s=>{const[r]=mt(s);return this.graph.nodes[r]==null});if(n.length>0)throw new Error(`The dict provided in model.execute(dict) has keys: [${n}] that are not part of graph`)}mapOutputs(t){return t.map(n=>this._signature!=null&&this._signature.outputs!=null&&this._signature.outputs[n]!=null?this._signature.outputs[n].name:n,{})}checkOutputs(t){t.forEach(n=>{const[s]=mt(n);if(!this.graph.nodes[s])throw new Error(`The output '${n}' is not found in the graph`)})}}class c0{constructor(t={},n={}){this.hashTableNameToHandle=t,this.hashTableMap=n}addHashTable(t,n){this.hashTableNameToHandle[t]=n.handle,this.hashTableMap[n.id]=n}getHashTableHandleByName(t){return this.hashTableNameToHandle[t]}getHashTableById(t){return this.hashTableMap[t]}dispose(){for(const t in this.hashTableMap)this.hashTableMap[t].clearAndClose(),delete this.hashTableMap[t];for(const t in this.hashTableNameToHandle)this.hashTableNameToHandle[t].dispose(),delete this.hashTableNameToHandle[t]}}/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */const l0="?tfjs-format=file",p0="model.json";class so{constructor(t,n={},s=fa){this.modelUrl=t,this.loadOptions=n,this.version="n/a",this.io=s,n==null&&(this.loadOptions={}),this.resourceManager=new c0}get modelVersion(){return this.version}get inputNodes(){return this.executor.inputNodes}get outputNodes(){return this.executor.outputNodes}get inputs(){return this.executor.inputs}get outputs(){return this.executor.outputs}get weights(){return this.executor.weightMap}get metadata(){return this.artifacts.userDefinedMetadata}get modelSignature(){return this.signature}get modelStructuredOutputKeys(){return this.structuredOutputKeys}findIOHandler(){const t=this.modelUrl;if(t.load!=null)this.handler=t;else if(this.loadOptions.requestInit!=null)this.handler=this.io.browserHTTPRequest(t,this.loadOptions);else{const n=this.io.getLoadHandlers(t,this.loadOptions);if(n.length===0)n.push(this.io.browserHTTPRequest(t,this.loadOptions));else if(n.length>1)throw new Error(`Found more than one (${n.length}) load handlers for URL '${[t]}'`);this.handler=n[0]}}load(){if(this.findIOHandler(),this.handler.load==null)throw new Error("Cannot proceed with model loading because the IOHandler provided does not have the `load` method implemented.");const t=this.handler.load();return te(t)?t.then(n=>this.loadSync(n)):this.loadSync(t)}loadSync(t){this.artifacts=t;const n=this.artifacts.modelTopology;let s=this.artifacts.signature;if(this.artifacts.userDefinedMetadata!=null){const a=this.artifacts.userDefinedMetadata;a.signature!=null&&(s=a.signature),a.structuredOutputKeys!=null&&(this.structuredOutputKeys=a.structuredOutputKeys)}this.signature=s,this.version=`${n.versions.producer}.${n.versions.minConsumer}`;const r=this.io.decodeWeights(this.artifacts.weightData,this.artifacts.weightSpecs);if(this.executor=new hn(br.Instance.transformGraph(n,this.signature)),this.executor.weightMap=this.convertTensorMapToTensorsMap(r),this.executor.resourceManager=this.resourceManager,t.modelInitializer!=null&&t.modelInitializer.node!=null){const a=br.Instance.transformGraph(t.modelInitializer);this.initializer=new hn(a),this.initializer.weightMap=this.executor.weightMap,this.initializer.resourceManager=this.resourceManager,this.initializer.executeAsync({},[])}return!0}async save(t,n){if(typeof t=="string"){const s=this.io.getSaveHandlers(t);if(s.length===0)throw new Error(`Cannot find any save handlers for URL '${t}'`);if(s.length>1)throw new Error(`Found more than one (${s.length}) save handlers for URL '${t}'`);t=s[0]}if(t.save==null)throw new Error("GraphModel.save() cannot proceed because the IOHandler provided does not have the `save` attribute defined.");return t.save(this.artifacts)}predict(t,n){const s=this.execute(t,this.outputNodes);if(this.structuredOutputKeys){const r=s instanceof Z?[s]:s,a={};return r.forEach((o,i)=>a[this.structuredOutputKeys[i]]=o),a}return s}normalizeInputs(t){if(!(t instanceof Z)&&!Array.isArray(t))return t;if(t=Array.isArray(t)?t:[t],t.length!==this.inputNodes.length)throw new Error(`Input tensor count mismatch,the graph model has ${this.inputNodes.length} placeholders, while there are ${t.length} input tensors.`);return this.inputNodes.reduce((n,s,r)=>(n[s]=t[r],n),{})}normalizeOutputs(t){return t=t||this.outputNodes,Array.isArray(t)?t:[t]}execute(t,n){t=this.normalizeInputs(t),n=this.normalizeOutputs(n);const s=this.executor.execute(t,n);return s.length>1?s:s[0]}async executeAsync(t,n){t=this.normalizeInputs(t),n=this.normalizeOutputs(n);const s=await this.executor.executeAsync(t,n);return s.length>1?s:s[0]}getIntermediateTensors(){return this.executor.getIntermediateTensors()}disposeIntermediateTensors(){this.executor.disposeIntermediateTensors()}convertTensorMapToTensorsMap(t){return Object.keys(t).reduce((n,s)=>(n[s]=[t[s]],n),{})}dispose(){this.executor.dispose(),this.initializer&&this.initializer.dispose(),this.resourceManager.dispose()}}async function $1(e,t={},n=fa){if(e==null)throw new Error("modelUrl in loadGraphModel() cannot be null. Please provide a url or an IOHandler that loads the model");t==null&&(t={}),t.fromTFHub&&typeof e=="string"&&(e=h0(e));const s=new so(e,t,n);return await s.load(),s}function k1(e){if(e==null)throw new Error("modelUrl in loadGraphModelSync() cannot be null. Please provide model artifacts or an IOHandler that loads the model");let t;if(e instanceof Array){const[s,r]=e;if(!s)throw new Error("modelJSON must be the first element of the array");if(!r||!(r instanceof ArrayBuffer))throw new Error("An ArrayBuffer of weights must be the second element of the array");if(!("modelTopology"in s))throw new Error("Model JSON is missing 'modelTopology'");if(!("weightsManifest"in s))throw new Error("Model JSON is missing 'weightsManifest'");const a=ks(s.weightsManifest),o=Ss(s,a,r);t=rn(o)}else if("load"in e)t=e;else if("modelTopology"in e&&"weightSpecs"in e&&"weightData"in e)t=rn(e);else throw new Error("Unknown model format");const n=new so(t);return n.load(),n}function h0(e){return e.endsWith("/")||(e=e+"/"),`${e}${p0}${l0}`}export{Dp as $,$n as A,lt as B,ns as C,Nn as D,N as E,F0 as F,V as G,Is as H,Nt as I,um as J,Rt as K,$o as L,Vn as M,Ql as N,Vs as O,tt as P,h1 as Q,Ea as R,ep as S,Z as T,vt as U,of as V,bn as W,Op as X,ba as Y,c1 as Z,p1 as _,y as a,xh as a$,l1 as a0,Pp as a1,Kt as a2,Sn as a3,f1 as a4,zs as a5,Rs as a6,d1 as a7,ma as a8,m1 as a9,jo as aA,g0 as aB,Go as aC,d0 as aD,Ho as aE,Mo as aF,Xo as aG,Va as aH,y0 as aI,Rr as aJ,Zo as aK,Qo as aL,be as aM,un as aN,Aa as aO,As as aP,ei as aQ,ni as aR,Le as aS,Ce as aT,si as aU,Yg as aV,Sa as aW,ai as aX,Tn as aY,b0 as aZ,oi as a_,C0 as aa,qs as ab,on as ac,Hr as ad,ga as ae,da as af,Mt as ag,xy as ah,Iy as ai,Ay as aj,Dg as ak,Fo as al,Ma as am,Co as an,Dt as ao,Bo as ap,Pr as aq,H as ar,v as as,Lo as at,zo as au,Vo as av,qo as aw,Uo as ax,Ko as ay,Wo as az,Gl as b,Oe as b$,ui as b0,Kd as b1,ci as b2,Gd as b3,pi as b4,Rh as b5,di as b6,ty as b7,ny as b8,wi as b9,E0 as bA,Zi as bB,$a as bC,Qi as bD,tu as bE,Bf as bF,_0 as bG,nu as bH,v0 as bI,eu as bJ,ru as bK,Jt as bL,au as bM,ou as bN,iu as bO,K as bP,uu as bQ,xa as bR,lu as bS,pu as bT,yu as bU,we as bV,gu as bW,bu as bX,ue as bY,wu as bZ,Nu as b_,N0 as ba,w0 as bb,Si as bc,T0 as bd,$i as be,re as bf,Ei as bg,vi as bh,_i as bi,Di as bj,Oi as bk,Fi as bl,Bd as bm,ve as bn,Ci as bo,_g as bp,Pi as bq,zr as br,Vi as bs,qi as bt,Ui as bu,Wi as bv,En as bw,Mi as bx,Gi as by,$0 as bz,m as c,wa as c$,Tu as c0,Su as c1,Lh as c2,Ni as c3,_u as c4,Ou as c5,xu as c6,Iu as c7,Du as c8,A0 as c9,nc as cA,gc as cB,ic as cC,Gu as cD,uc as cE,cc as cF,Vr as cG,In as cH,fc as cI,Bt as cJ,mc as cK,Ia as cL,Gt as cM,dc as cN,B0 as cO,Vc as cP,up as cQ,lp as cR,mp as cS,gp as cT,bp as cU,Np as cV,Sp as cW,kp as cX,vp as cY,xp as cZ,Ap as c_,Au as ca,I0 as cb,Fu as cc,ae as cd,Cu as ce,Bu as cf,Ru as cg,Ba as ch,zu as ci,ju as cj,Wu as ck,qu as cl,Oh as cm,Uu as cn,Ch as co,Vu as cp,Ve as cq,Yu as cr,Ku as cs,fe as ct,Mu as cu,Na as cv,Xu as cw,pt as cx,Hu as cy,D0 as cz,st as d,Ie as d$,wn as d0,He as d1,uh as d2,lh as d3,Th as d4,kh as d5,Uh as d6,_s as d7,Gh as d8,Zh as d9,fm as dA,dm as dB,kn as dC,za as dD,km as dE,Vm as dF,qa as dG,Wm as dH,Td as dI,_n as dJ,ja as dK,jy as dL,Hy as dM,Bs as dN,Ka as dO,Pd as dP,zd as dQ,Wd as dR,sg as dS,Fa as dT,Ga as dU,Ls as dV,mg as dW,gg as dX,ts as dY,Tg as dZ,Eg as d_,tf as da,ka as db,af as dc,gf as dd,Nf as de,Cs as df,ya as dg,ln as dh,Ha as di,xf as dj,Af as dk,Of as dl,Da as dm,zf as dn,jf as dp,Gf as dq,Ca as dr,Oa as ds,La as dt,Qf as du,Pa as dv,me as dw,cn as dx,es as dy,Ra as dz,R as e,xc as e$,a1 as e0,eg as e1,Qd as e2,Jd as e3,Xd as e4,Ua as e5,oy as e6,$t as e7,bh as e8,gh as e9,nh as eA,rm as eB,qp as eC,te as eD,ws as eE,Uc as eF,Os as eG,xt as eH,_e as eI,Ac as eJ,uo as eK,m0 as eL,M0 as eM,Ft as eN,_r as eO,vo as eP,Eo as eQ,ti as eR,dn as eS,vu as eT,So as eU,gn as eV,xr as eW,ki as eX,Li as eY,ji as eZ,Ki as e_,mh as ea,hh as eb,Hg as ec,_a as ed,Vb as ee,Wa as ef,$g as eg,Ag as eh,Fr as ei,Vt as ej,Er as ek,X0 as el,ol as em,Yc as en,Ts as eo,Ll as ep,il as eq,Vl as er,Qr as es,Ah as et,zb as eu,Zg as ev,vh as ew,ym as ex,Zp as ey,th as ez,tp as f,po as f$,hu as f0,_c as f1,en as f2,qn as f3,r1 as f4,To as f5,Hs as f6,Po as f7,Ro as f8,Yo as f9,Ji as fA,su as fB,cu as fC,fu as fD,mu as fE,du as fF,ht as fG,$u as fH,ku as fI,Eu as fJ,yc as fK,Lu as fL,Pu as fM,Ju as fN,Zu as fO,Qu as fP,tc as fQ,ec as fR,sc as fS,rc as fT,ac as fU,oc as fV,lc as fW,pc as fX,hc as fY,bc as fZ,bo as f_,Jo as fa,zi as fb,ri as fc,ii as fd,hi as fe,li as ff,ms as fg,fi as fh,mi as fi,gi as fj,yi as fk,bi as fl,Zt as fm,ko as fn,Ti as fo,xi as fp,Ii as fq,mn as fr,Ai as fs,Gs as ft,Ms as fu,Bi as fv,Ri as fw,Hi as fx,Xi as fy,Yi as fz,Xs as g,vm as g$,vr as g0,Ee as g1,Mc as g2,No as g3,ho as g4,Pn as g5,Yr as g6,de as g7,V0 as g8,Br as g9,G0 as gA,nf as gB,j0 as gC,W0 as gD,Ya as gE,n1 as gF,s1 as gG,iy as gH,Wg as gI,t1 as gJ,Ys as gK,Rn as gL,g1 as gM,y1 as gN,yn as gO,Mg as gP,fa as gQ,Pf as gR,$1 as gS,k1 as gT,qb as gU,em as gV,om as gW,lm as gX,Lg as gY,wm as gZ,Tm as g_,_o as ga,so as gb,S0 as gc,k0 as gd,Zr as ge,x0 as gf,tr as gg,ft as gh,O0 as gi,nn as gj,hp as gk,Gp as gl,Ta as gm,Cg as gn,ah as go,i1 as gp,Ut as gq,R0 as gr,Ps as gs,Ct as gt,Vh as gu,H0 as gv,S1 as gw,U0 as gx,Kh as gy,K0 as gz,Pe as h,Im as h0,Dm as h1,Fm as h2,Bm as h3,ua as h4,Y0 as h5,Km as h6,Gm as h7,Xm as h8,dd as h9,P0 as hA,L0 as hB,Ig as hC,z0 as hD,b1 as hE,w1 as hF,Xa as hG,bd as ha,Fe as hb,Q0 as hc,De as hd,T1 as he,e1 as hf,vd as hg,xd as hh,Ad as hi,Od as hj,Rg as hk,u1 as hl,Ds as hm,Z0 as hn,o1 as ho,qd as hp,Rb as hq,Ub as hr,qg as hs,Pb as ht,Wb as hu,yg as hv,bg as hw,wg as hx,q0 as hy,J0 as hz,lo as i,bs as j,fn as k,Wt as l,W as m,Ot as n,b as o,Et as p,Be as q,Ml as r,Q as s,Zn as t,U as u,N1 as v,kt as w,rt as x,z as y,xs as z};
