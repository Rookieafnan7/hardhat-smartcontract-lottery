const { network, ethers } = require("hardhat")
const { developmentChains } = require("../helper-hardhat-config")

const BASE_FEE = ethers.parseEther("0.25") //0.25 is premium, it const 0.25 LINK per request
//prettier-ignore
const GAS_PRICE_LINK = 1e9 //1000000000
//calculated value based on the gasprice of the chain
module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    // console.log("deployer", deployer)
    const chainId = network.config.chainId
    const args = [BASE_FEE, GAS_PRICE_LINK]
    if (developmentChains.includes(network.name)) {
        log("Local network detected! Deploying mocks...")
        await deploy("VRFCoordinatorV2Mock", {
            from: deployer,
            log: true,
            args: args,
        })
        log("Mocks Deployed!")
        log("________________________________")
    }
}

module.exports.tags = ["all", "mocks"]
