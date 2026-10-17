import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  has: vi.fn(),
  find: vi.fn(),
  create: vi.fn(),
  touch: vi.fn(),
}));
vi.mock("../client/src/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("./db", () => ({
  hasAuthIdentity: mocks.has,
  getUserByEmail: mocks.find,
  createUserForAuthIdentity: mocks.create,
  touchUserLastSignIn: mocks.touch,
}));
import { createContext } from "./_core/context";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({
    user: { id: "auth-fixture", email: "owner@example.test", name: "Fixture" },
    provider: "google",
  });
  mocks.has.mockResolvedValue(true);
  mocks.create.mockResolvedValue(undefined);
});
describe("deleted Auth.js identity bridge", () => {
  it("an unexpired old JWT cannot recreate an account after the adapter identity was deleted", async () => {
    mocks.has.mockResolvedValue(false);
    expect((await createContext()).user).toBeNull();
    expect(mocks.find).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("rejects a session without its adapter identity id", async () => {
    mocks.auth.mockResolvedValue({ user: { email: "owner@example.test" } });
    expect((await createContext()).user).toBeNull();
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("does not authenticate or touch an application tombstone", async () => {
    mocks.find.mockResolvedValue({ id: 7, loginMethod: "deleted" });
    expect((await createContext()).user).toBeNull();
    expect(mocks.touch).not.toHaveBeenCalled();
  });
  it("creates a first-login user only through the locked adapter-identity helper", async () => {
    const created = { id: 7, loginMethod: "google" };
    mocks.find.mockResolvedValueOnce(null).mockResolvedValueOnce(created);
    expect((await createContext()).user).toEqual(created);
    expect(mocks.create).toHaveBeenCalledWith({
      id: "auth-fixture",
      email: "owner@example.test",
      name: "Fixture",
      provider: "google",
    });
  });
  it("stays anonymous if identity deletion wins the first-login bridge race", async () => {
    mocks.find.mockResolvedValue(null);
    expect((await createContext()).user).toBeNull();
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });
});
