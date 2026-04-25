// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IdentityRegistry} from "./IdentityRegistry.sol";

/// @title KYCGatedAuction
/// @notice Allows only verified identities to place bids.
/// @dev Uses pull payments for refunds so placeBid does not transfer ETH to bidders.
contract KYCGatedAuction is Ownable, ReentrancyGuard {
    IdentityRegistry public immutable IDENTITY_REGISTRY;

    address public highestBidder;
    uint256 public highestBid;
    bool public ended;

    mapping(address bidder => uint256 refundAmount) public pendingReturns;

    event BidPlaced(address indexed bidder, uint256 amount);
    event AuctionEnded(address indexed winner, uint256 amount);
    event RefundWithdrawn(address indexed bidder, uint256 amount);
    event ProceedsWithdrawn(address indexed recipient, uint256 amount);

    /// @notice Creates a KYC-gated auction.
    /// @param identityRegistry_ Address of the registry used for verification checks.
    /// @param initialOwner Address that can end the auction and withdraw proceeds.
    constructor(address identityRegistry_, address initialOwner) Ownable(initialOwner) {
        require(identityRegistry_ != address(0), "Registry cannot be zero");
        require(initialOwner != address(0), "Owner cannot be zero");
        IDENTITY_REGISTRY = IdentityRegistry(identityRegistry_);
    }

    /// @notice Places a bid if the caller has a verified identity.
    /// @dev Previous highest bids become pending refunds and are withdrawn separately.
    function placeBid() external payable nonReentrant {
        require(!ended, "Auction already ended");
        require(IDENTITY_REGISTRY.isVerified(msg.sender), "KYC required");
        require(msg.value > highestBid, "Bid too low");

        if (highestBidder != address(0)) {
            pendingReturns[highestBidder] += highestBid;
        }

        highestBidder = msg.sender;
        highestBid = msg.value;

        emit BidPlaced(msg.sender, msg.value);
    }

    /// @notice Withdraws an outbid bidder's refundable ETH.
    function withdrawRefund() external nonReentrant {
        uint256 amount = pendingReturns[msg.sender];
        require(amount > 0, "No funds to withdraw");

        pendingReturns[msg.sender] = 0;

        (bool success,) = msg.sender.call{value: amount}("");
        require(success, "ETH transfer failed");

        emit RefundWithdrawn(msg.sender, amount);
    }

    /// @notice Ends the auction and locks in the current winner.
    function endAuction() external onlyOwner {
        require(!ended, "Auction already ended");
        ended = true;
        emit AuctionEnded(highestBidder, highestBid);
    }

    /// @notice Withdraws the winning bid after the auction has ended.
    /// @param recipient Address that receives auction proceeds.
    function withdrawProceeds(address payable recipient) external onlyOwner nonReentrant {
        require(recipient != address(0), "Recipient cannot be zero");
        require(ended, "Auction not ended");

        uint256 amount = highestBid;
        require(amount > 0, "No funds to withdraw");

        highestBid = 0;

        (bool success,) = recipient.call{value: amount}("");
        require(success, "ETH transfer failed");

        emit ProceedsWithdrawn(recipient, amount);
    }
}
