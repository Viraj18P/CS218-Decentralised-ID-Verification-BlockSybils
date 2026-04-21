pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";

// Proves that a holder's age is >= min_age_days without revealing their birthdate.
//
// Date representation: integer days since Unix epoch (1970-01-01).
//   birthdate_days  = floor(birthdate_unix_seconds / 86400)
//   current_days    = floor(block.timestamp / 86400)      <- supplied by verifier
//
// Public signals layout (index → name):
//   [0] current_days   — days since epoch at proof generation time
//   [1] min_age_days   — minimum age in days (e.g. 18 * 365 = 6570)
//   [2] commitment     — Poseidon(birthdate_days, salt), binds private input on-chain
template AgeVerifier() {
    // --- Private inputs (stay off-chain) ---
    signal input birthdate_days;
    signal input salt;

    // --- Public inputs (go on-chain as publicSignals[0..2]) ---
    signal input current_days;
    signal input min_age_days;
    signal input commitment;

    // 1. Verify the Poseidon commitment to birthdate_days.
    component hasher = Poseidon(2);
    hasher.inputs[0] <== birthdate_days;
    hasher.inputs[1] <== salt;
    commitment === hasher.out;

    // 2. Compute age in days.
    signal age_days;
    age_days <== current_days - birthdate_days;

    // 3. Enforce age_days >= min_age_days.
    //    GreaterEqThan(32) handles values up to 2^32 - 1 (~11755 years), sufficient for any age.
    component gte = GreaterEqThan(32);
    gte.in[0] <== age_days;
    gte.in[1] <== min_age_days;
    gte.out === 1;
}

component main { public [current_days, min_age_days, commitment] } = AgeVerifier();
