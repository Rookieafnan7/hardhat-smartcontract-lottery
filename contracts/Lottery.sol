//SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;
import "hardhat/console.sol";
/**
 * @title A simple Lottery Contract
 * @author Afnan Nizam
 * @notice This contract is for creating untamperable decentralized smart contract
 * @dev This implements Chainlink VRF V2 and Chainlink Keepers
 */

import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/vrf/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/automation/interfaces/AutomationCompatibleInterface.sol";

error Lottery__NotEnoughETHEntered();
error Lottery__TransferFailed();
error Lottery__NotOpen();
error Lottery__UpkeepNotNeeded(
    uint256 currentBalance,
    uint256 numPlayers,
    uint256 raffleState
);

contract Lottery is VRFConsumerBaseV2, AutomationCompatibleInterface {
    enum LotteryState {
        OPEN,
        CALCULATING
    }

    uint256 private immutable i_entraneFee;
    address[] private s_players;
    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
    bytes32 private immutable i_gasLane;
    uint64 private immutable i_subscriptionId;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private immutable i_callbackGasLimit;
    uint32 private constant NUM_WORDS = 1;

    //Lottery

    address private s_recentWinner;
    LotteryState private s_lotteryState;
    uint256 private s_lastTimeStamp;
    uint256 private immutable i_interval;
    /*Events*/

    event LotteryEnter(address indexed player);
    event RequestedLotteryWinner(uint256 indexed requestId);
    event WinnerPicked(address indexed winner);

    constructor(
        uint256 entranceFee,
        address vrfCoordinatorV2,
        bytes32 gasLane,
        uint64 subscriptionId,
        uint32 callbackGasLimit,
        uint256 interval
    ) VRFConsumerBaseV2(vrfCoordinatorV2) {
        i_entraneFee = entranceFee;
        i_gasLane = gasLane;
        i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
        i_subscriptionId = subscriptionId;
        i_callbackGasLimit = callbackGasLimit;
        s_lotteryState = LotteryState.OPEN; //LotteryState(0)
        s_lastTimeStamp = block.timestamp;
        i_interval = interval;
    }

    function enterLottery() public payable {
        if (s_lotteryState != LotteryState.OPEN) {
            revert Lottery__NotOpen();
        }
        if (msg.value < i_entraneFee) {
            revert Lottery__NotEnoughETHEntered();
        }

        s_players.push(payable(msg.sender));
        emit LotteryEnter(msg.sender);
    }

    /**
     * @dev This is the function that chainlink keeper nodes call
     * They look for the `upKeepNeeded` to return true
     * The following should be new in order to return true
     * 1. Our time interval should have passed
     * 2. The lottery should have atleast one player, and have some ETH
     * 3. The subscription should be funded with LINK
     * 4. Lottery should be in an open state
     *
     */

    function checkUpkeep(
        bytes memory /*checkData*/
    )
        public
        view
        override
        returns (
            // view/
            bool upKeepNeeded,
            bytes memory performData
        )
    {
        // upKeepNeeded =
        bool isOpen = (LotteryState.OPEN == s_lotteryState);
        bool timePassed = (block.timestamp - s_lastTimeStamp) > i_interval;
        bool hasPlayers = s_players.length > 0;
        bool hasBalance = address(this).balance > 0;
        performData = "";

        // console.log(
        //     "Values %s %s %s %s",
        //     isOpen,
        //     timePassed,
        //     hasPlayers,
        //     hasBalance
        // );
        upKeepNeeded = (isOpen && timePassed && hasPlayers && hasBalance);
        console.log("upKeepNeeded value is %s", upKeepNeeded);
    }

    // function requestRandomWinner() external {
    //     //request random number
    // }

    function performUpkeep(bytes calldata /*performData*/) external override {
        // bytes calldata dummy = 0xabcdef1234567890;
        // (bool upKeepNeeded, ) = checkUpkeep("");
        // if (!upKeepNeeded) {
        //     revert Lottery__UpkeepNotNeeded(
        //         address(this).balance,
        //         s_players.length,
        //         uint256(s_lotteryState)
        //     );
        // }
        console.log("Perform Upkeep called");
        s_lotteryState = LotteryState.CALCULATING;
        uint256 requestId = i_vrfCoordinator.requestRandomWords(
            i_gasLane,
            i_subscriptionId,
            REQUEST_CONFIRMATIONS,
            i_callbackGasLimit,
            NUM_WORDS
        );
        emit RequestedLotteryWinner(requestId);
    }

    function fulfillRandomWords(
        uint256,
        //  requestId,
        uint256[] memory randomWords
    ) internal override {
        uint256 indexOfWinner = randomWords[0] % s_players.length;
        address payable recentWinner = payable(s_players[indexOfWinner]);
        s_recentWinner = recentWinner;
        s_lotteryState = LotteryState.OPEN;
        s_players = new address[](0);
        s_lastTimeStamp = block.timestamp;
        (bool success, ) = recentWinner.call{value: address(this).balance}("");
        if (!success) {
            revert Lottery__TransferFailed();
        }

        emit WinnerPicked(recentWinner);
    }

    // view / pure functions
    function getEntranceFee() public view returns (uint256) {
        return i_entraneFee;
    }

    function getPlayer(uint256 index) public view returns (address) {
        return s_players[index];
    }

    function getRecentWinner() public view returns (address) {
        return s_recentWinner;
    }

    function getLotteryState() public view returns (LotteryState) {
        return s_lotteryState;
    }

    function getNumWords() public pure returns (uint256) {
        return NUM_WORDS;
    }

    function getNumberOfPlayers() public view returns (uint256) {
        return s_players.length;
    }

    function getLatestTimeStamp() public view returns (uint256) {
        return s_lastTimeStamp;
    }

    function getRequestConfirmations() public pure returns (uint256) {
        return REQUEST_CONFIRMATIONS;
    }

    function getInterval() public view returns (uint256) {
        return i_interval;
    }

    function getSubscriptionId() public view returns (uint64) {
        return i_subscriptionId;
    }
}
