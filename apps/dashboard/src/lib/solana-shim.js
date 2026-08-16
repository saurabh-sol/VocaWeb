// Empty shim to replace incompatible @solana-program/* modules during build.
// These are transitive deps of @privy-io/react-auth that have version conflicts
// but are not actually used by our wallet connection flow.
module.exports = {};
