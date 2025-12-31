// Test script to verify live URL generation
const hostUri = "8081-i4k0orawdmfzlz97qze7e-c1ad53ca.us2.manus.computer:8081";
const [host] = hostUri.split(':');
const baseUrl = `https://${host}`;
const pairCode = "TEST123";
const liveUrl = `${baseUrl}/live/${pairCode}`;

console.log("Metro hostUri:", hostUri);
console.log("Extracted host:", host);
console.log("Base URL:", baseUrl);
console.log("Live URL:", liveUrl);
console.log("\nExpected: https://8081-i4k0orawdmfzlz97qze7e-c1ad53ca.us2.manus.computer/live/TEST123");
