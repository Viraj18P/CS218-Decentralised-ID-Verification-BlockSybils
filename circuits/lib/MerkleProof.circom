pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/mux1.circom";

// Verifies a Poseidon-hashed binary Merkle inclusion proof.
// path_indices[i] = 0 means the current node is the left child at level i.
template MerkleProofVerifier(depth) {
    signal input leaf;
    signal input path_elements[depth];
    signal input path_indices[depth];
    signal output root;

    component hashers[depth];
    component muxL[depth];
    component muxR[depth];
    signal levelHashes[depth + 1];
    levelHashes[0] <== leaf;

    for (var i = 0; i < depth; i++) {
        muxL[i] = Mux1();
        muxL[i].c[0] <== levelHashes[i];
        muxL[i].c[1] <== path_elements[i];
        muxL[i].s    <== path_indices[i];

        muxR[i] = Mux1();
        muxR[i].c[0] <== path_elements[i];
        muxR[i].c[1] <== levelHashes[i];
        muxR[i].s    <== path_indices[i];

        hashers[i] = Poseidon(2);
        hashers[i].inputs[0] <== muxL[i].out;
        hashers[i].inputs[1] <== muxR[i].out;

        levelHashes[i + 1] <== hashers[i].out;
    }

    root <== levelHashes[depth];
}
