import assert from "node:assert/strict";
import { test } from "node:test";
import { createPinnedLookup, isPublicAddress, validatePublicUrl } from "./public-page.ts";

test("research destinations are HTTPS and explicitly approved", () => {
	const hosts = ["www.assistant-ui.com"];
	assert.equal(validatePublicUrl("https://www.assistant-ui.com/components#tools", hosts).hash, "");
	for (const url of ["http://www.assistant-ui.com", "https://localhost", "https://127.0.0.1", "https://www.assistant-ui.com:3100", "https://user:pass@www.assistant-ui.com", "https://www.assistant-ui.com.attacker.invalid"])
		assert.throws(() => validatePublicUrl(url, hosts));
});
test("pinned DNS lookup supports single-address and all-address callbacks", () => {
	const lookup = createPinnedLookup("1.1.1.1", 4);
	let all: unknown;
	let one: unknown;
	let family: number | undefined;
	lookup("research.test", { all: true }, (_error, address) => { all = address; });
	lookup("research.test", {}, (_error, address, resolvedFamily) => { one = address; family = resolvedFamily; });
	assert.deepEqual(all, [{ address: "1.1.1.1", family: 4 }]);
	assert.equal(one, "1.1.1.1");
	assert.equal(family, 4);
});

test("private, reserved and mapped IPs cannot be contacted", () => {
	for (const ip of ["127.0.0.1", "10.0.0.1", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "::ffff:127.0.0.1", "fe80::1", "fc00::1", "2001:db8::1", "2002:7f00:1::"])
		assert.equal(isPublicAddress(ip), false, ip);
	assert.equal(isPublicAddress("1.1.1.1"), true);
	assert.equal(isPublicAddress("2606:4700:4700::1111"), true);
});
