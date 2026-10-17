import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({send:vi.fn(),sign:vi.fn(),verify:vi.fn(),config:vi.fn(),register:vi.fn(),confirm:vi.fn(),assets:new Map<string,any>(),clients:[] as any[]}));
const privateConfig={bucket:"fixture-private-bucket",accountId:"a".repeat(32),accessKeyId:"fixture-private-access",secretAccessKey:"fixture-private-secret"};
vi.mock("./_core/env",()=>({ENV:{r2AccountId:"a".repeat(32),r2AccessKeyId:"fixture-public-access",r2SecretAccessKey:"fixture-public-secret",r2BucketName:"fixture-public-bucket",r2PublicUrl:"https://public.fixture.example"}}));
vi.mock("./_core/privateStorage",()=>({assertPrivateStorage:mocks.verify,privateStorageConfig:mocks.config}));
vi.mock("./_core/mediaLifecycle",()=>({getMediaAsset:async(key:string)=>mocks.assets.get(key),registerMediaAsset:mocks.register,confirmMediaUpload:mocks.confirm,normalizeStorageKey:(key:string)=>key.replace(/^\//,"")}));
vi.mock("@aws-sdk/client-s3",()=>({S3Client:class{constructor(options:any){mocks.clients.push(options);}send(command:any){return mocks.send(command);}},PutObjectCommand:class{operation="put";constructor(public input:any){}},GetObjectCommand:class{operation="get";constructor(public input:any){}},DeleteObjectCommand:class{operation="delete";constructor(public input:any){}}}));
vi.mock("@aws-sdk/s3-request-presigner",()=>({getSignedUrl:mocks.sign}));
import {storagePut,storageGetObjectBounded,storageGetObject,storageGetSigned,storageGet,storageDelete,getUploadUrl} from "./storage";
import {withStorageOwner} from "./_core/storageContext";
describe("private object bucket separation",()=>{
  beforeEach(()=>{
    mocks.assets.clear();mocks.send.mockReset().mockImplementation(async()=>({Body:{async *[Symbol.asyncIterator](){yield Buffer.from("fixture-bytes");},transformToByteArray:async()=>Buffer.from("fixture-bytes"),destroy:()=>{}},ContentType:"image/png"}));
    mocks.verify.mockReset().mockResolvedValue(privateConfig);mocks.config.mockReset().mockReturnValue(privateConfig);mocks.confirm.mockReset().mockResolvedValue(undefined);
    mocks.sign.mockReset().mockImplementation(async(_client,command)=>`https://signed.fixture.example/${command.input.Bucket}/${command.input.Key}`);
    mocks.register.mockReset().mockImplementation(async(key:string,owner:number,isPrivate:boolean)=>{const prior=mocks.assets.get(key);if(prior&&prior.isPrivate!==isPrivate)throw new Error("This media upload is no longer allowed.");mocks.assets.set(key,{ownerUserId:owner,isPrivate,revokedAt:null,ownerDeleted:false});});
  });
  it("writes public and private data to distinct buckets/credentials and never returns a private public-alias URL",async()=>{
    const publicResult=await withStorageOwner(7,()=>storagePut("images/public.png",Buffer.from("public"),"image/png"));
    const privateResult=await withStorageOwner(7,()=>storagePut("uploads/7/private.png",Buffer.from("private"),"image/png",{isPrivate:true}));
    expect(mocks.send.mock.calls.map(([command])=>command.input.Bucket)).toEqual(["fixture-public-bucket","fixture-private-bucket"]);
    expect(publicResult.url).toBe("https://public.fixture.example/images/public.png");expect(privateResult.url).toBe("/api/media/uploads/7/private.png");
    expect(mocks.clients.some(client=>client.credentials.accessKeyId==="fixture-private-access")).toBe(true);expect(mocks.verify).toHaveBeenCalledOnce();
  });
  it("routes private bounded/full reads and provider signatures only to the private bucket",async()=>{
    mocks.assets.set("private/key",{isPrivate:true});
    expect(Buffer.from((await storageGetObjectBounded("private/key",100))!.bytes).toString()).toBe("fixture-bytes");
    await storageGetObject("private/key");expect(await storageGetSigned("private/key",60)).toContain("/fixture-private-bucket/private/key");
    expect(mocks.send.mock.calls.every(([command])=>command.input.Bucket==="fixture-private-bucket")).toBe(true);expect(mocks.verify).toHaveBeenCalledTimes(3);
  });
  it("fails closed before private I/O when origin verification fails and never falls back to public storage",async()=>{
    mocks.verify.mockRejectedValue(new Error("Private storage unavailable"));mocks.assets.set("private/key",{isPrivate:true});
    await expect(withStorageOwner(7,()=>storagePut("private/new",Buffer.from("private"),"image/png",{isPrivate:true}))).rejects.toThrow("unavailable");
    await expect(storageGetObjectBounded("private/key",100)).rejects.toThrow("unavailable");await expect(storageGetSigned("private/key",60)).rejects.toThrow("unavailable");
    expect(mocks.send).not.toHaveBeenCalled();expect(mocks.sign).not.toHaveBeenCalled();expect(mocks.register).not.toHaveBeenCalled();
  });
  it("rejects public alias helpers and classification changes for an owned private key",async()=>{
    await withStorageOwner(7,()=>storagePut("private/key",Buffer.from("private"),"image/png",{isPrivate:true}));
    await expect(storageGet("private/key")).rejects.toThrow("public download aliases");await expect(getUploadUrl("private/key","image/png")).rejects.toThrow("public upload aliases");
    await expect(withStorageOwner(7,()=>storagePut("private/key",Buffer.from("public"),"image/png"))).rejects.toThrow("no longer allowed");
    await withStorageOwner(7,()=>storagePut("public/key",Buffer.from("public"),"image/png"));
    await expect(withStorageOwner(7,()=>storagePut("public/key",Buffer.from("private"),"image/png",{isPrivate:true}))).rejects.toThrow("no longer allowed");
    expect(mocks.send).toHaveBeenCalledTimes(2);
  });
  it("deletes revoked private objects from their private bucket even during a public-access audit outage",async()=>{
    mocks.assets.set("private/revoked",{isPrivate:true,revokedAt:new Date()});mocks.verify.mockRejectedValue(new Error("Audit offline"));
    await storageDelete("private/revoked");expect(mocks.send.mock.calls[0][0]).toMatchObject({operation:"delete",input:{Bucket:"fixture-private-bucket",Key:"private/revoked"}});expect(mocks.verify).not.toHaveBeenCalled();
    mocks.config.mockImplementation(()=>{throw new Error("Private config absent");});await expect(storageDelete("private/revoked")).rejects.toThrow("config absent");expect(mocks.send).toHaveBeenCalledOnce();
  });
});
