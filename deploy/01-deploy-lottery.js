const { network, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../helper-hardhat-config")
// const { TransactionReceipt } = require("ethers")
const { verify } = require("../utils/verify")
const VRF_SUBSCRIPTION_FUND_AMOUNT = ethers.parseEther("30")
module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId
    let vrfCoordinatorV2Address, subscriptionId, vrfCoordinatorV2Mock
    if (developmentChains.includes(network.name)) {
        vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")

        vrfCoordinatorV2Address = await vrfCoordinatorV2Mock.getAddress()
        // console.log(vrfCoordinatorV2Address)
        const transactionResponse =
            await vrfCoordinatorV2Mock.createSubscription()
        const transactionReceipt = await transactionResponse.wait()
        // console.log(transactionReceipt.logs)
        subscriptionId = transactionReceipt.logs[0].args.subId
        // console.log(subscriptionId)
        //Fund the token
        //Usually you'd need a link token on a real network
        await vrfCoordinatorV2Mock.fundSubscription(
            subscriptionId,
            VRF_SUBSCRIPTION_FUND_AMOUNT,
        )
        // "confirma"
        // console.log("funded")
    } else {
        vrfCoordinatorV2Address = networkConfig[chainId]["vrfCoordinatorV2"]
        subscriptionId = networkConfig[chainId]["subscriptionId"]
    }

    const entranceFee = networkConfig[chainId]["entranceFee"]
    // console.log(entranceFee)
    const gasLane = networkConfig[chainId]["gasLane"]
    // console.log()
    const callbackGasLimit = networkConfig[chainId]["callbackGasLimit"]
    // console.log(callbackGasLimit)
    const interval = networkConfig[chainId]["interval"]
    const args = [
        entranceFee,
        vrfCoordinatorV2Address,
        gasLane,
        subscriptionId,
        callbackGasLimit,
        interval,
    ]

    const lottery = await deploy("Lottery", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    })
    // await lottery.wait()
    // console.log(lottery.address)
    if (developmentChains.includes(network.name)) {
        const vrfCoordinatorV2Mock = await ethers.getContract(
            "VRFCoordinatorV2Mock",
        )
        await vrfCoordinatorV2Mock.addConsumer(subscriptionId, lottery.address)
    }
    // console.log("deployed lottery")
    if (
        !developmentChains.includes(network.name) &&
        process.env.ETHERSCAN_API_KEY
    ) {
        log("Verifying....")
        await verify(lottery.address, args)
    }
}

module.exports.tags = ["all", "lottery"]
