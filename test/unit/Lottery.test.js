const { network, getNamedAccounts, deployments, ethers } = require("hardhat")
const {
    developmentChains,
    networkConfig,
} = require("../../helper-hardhat-config")
const { assert, expect } = require("chai")
// const { readConfigFile } = require("typescript")
!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Lottery Unit Test", function () {
          let lottery,
              vrfCoordinatorV2Mock,
              lotteryEntranceFee,
              deployer,
              interval
          //   subscriptionId
          const chainId = network.config.chainId
          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer
              await deployments.fixture(["all"])

              lottery = await ethers.getContract("Lottery", deployer)

              vrfCoordinatorV2Mock = await ethers.getContract(
                  "VRFCoordinatorV2Mock",
                  deployer,
              )
              //   subscriptionId = await lottery.getSubscriptionId()
              //   console.log("subscriptionId", subscriptionId)
              lotteryEntranceFee = await lottery.getEntranceFee()
              interval = await lottery.getInterval()
          })
          describe("constructor", function () {
              it("Initializes the lottery correctly", async function () {
                  const lotteryState = await lottery.getLotteryState()
                  assert.equal(lotteryState.toString(), "0")
                  assert.equal(
                      interval.toString(),
                      networkConfig[chainId]["interval"],
                  )
              })
          })
          describe("enter lottery", function () {
              it("It reverts when you don't pay enough", async function () {
                  await expect(
                      lottery.enterLottery(),
                  ).to.be.revertedWithCustomError(
                      lottery,
                      "Lottery__NotEnoughETHEntered",
                  )
              })
              it("It records players when they enter", async function () {
                  await lottery.enterLottery({ value: lotteryEntranceFee })
                  const playerFromContract = await lottery.getPlayer(0)
                  assert.equal(playerFromContract, deployer)
              })
              it("Emits event on enter", async function () {
                  await expect(
                      lottery.enterLottery({ value: lotteryEntranceFee }),
                  ).to.emit(lottery, "LotteryEnter")
              })
              it("doesn't allow entrance when lottery is calculating", async function () {
                  await lottery.enterLottery({ value: lotteryEntranceFee })
                  await network.provider.send("evm_increaseTime", [
                      Number(interval) + 1,
                  ])
                  await network.provider.send("hardhat_mine", [])
                  await lottery.performUpkeep("0x00")
                  await expect(
                      lottery.enterLottery(),
                  ).to.be.revertedWithCustomError(lottery, "Lottery__NotOpen")
              })
          })
          describe("checkupkeep", () => {
              it("returns if people haven't sent any ETH", async function () {
                  await network.provider.send("evm_increaseTime", [
                      Number(interval) + 1,
                  ])
                  await network.provider.send("hardhat_mine", [])
                  //   console.log(lottery)
                  const [upkeepNeeded] =
                      await lottery.checkUpkeep.staticCall("0x00")
                  //   console.log(upkeepNeeded)
                  assert(!upkeepNeeded)
              })
              it("returns false if lottery isn't open", async function () {
                  await lottery.enterLottery({ value: lotteryEntranceFee })
                  await network.provider.send("evm_increaseTime", [
                      Number(interval) + 1,
                  ])
                  await network.provider.send("hardhat_mine", [])
                  await lottery.performUpkeep("0x00")
                  const lotteryState = await lottery.getLotteryState()
                  const [upkeepNeeded] =
                      await lottery.checkUpkeep.staticCall("0x00")
                  assert.equal(lotteryState.toString(), "1")
                  assert.equal(upkeepNeeded, false)
              })
              it("returns false if enough time hasn't passed", async () => {
                  await lottery.enterLottery({ value: lotteryEntranceFee })
                  await network.provider.send("evm_increaseTime", [
                      Number(interval) - 5,
                  ]) // use a higher number here if this test fails
                  await network.provider.request({
                      method: "evm_mine",
                      params: [],
                  })
                  const [upkeepNeeded] =
                      await lottery.checkUpkeep.staticCall("0x") // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
                  assert(!upkeepNeeded)
              })
              it("returns true if enough time has passed, has players, eth, and is open", async () => {
                  await lottery.enterLottery({ value: lotteryEntranceFee })
                  await network.provider.send("evm_increaseTime", [
                      Number(interval) + 1,
                  ])
                  await network.provider.request({
                      method: "evm_mine",
                      params: [],
                  })
                  const [upkeepNeeded] =
                      await lottery.checkUpkeep.staticCall("0x") // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
                  assert(upkeepNeeded)
              })
              describe("performUpkeep", function () {
                  it("it can only enter if checkupkeep is true", async function () {
                      await lottery.enterLottery({ value: lotteryEntranceFee })
                      await network.provider.send("evm_increaseTime", [
                          Number(interval) + 1,
                      ])
                      const tx = await lottery.performUpkeep("0x00")
                      assert(tx)
                  })
                  //   it("reverts when checkupkeep is false", async function () {
                  //       await expect(
                  //           lottery.performUpkeep("0x00"),
                  //       ).to.be.revertedWithCustomError(
                  //           lottery,
                  //           "Lottery__UpkeepNotNeeded",
                  //       )
                  //   })
                  it("updates the lottery state, emits the events and calls the vrfCoordinator", async function () {
                      await lottery.enterLottery({ value: lotteryEntranceFee })
                      await network.provider.send("evm_increaseTime", [
                          Number(interval) + 1,
                      ])
                      await network.provider.request({
                          method: "evm_mine",
                          params: [],
                      })
                      const txResponse = await lottery.performUpkeep("0x00")
                      const txReceipt = await txResponse.wait()
                      const requestId = txReceipt.logs[1].args.requestId
                      const lotteryState = await lottery.getLotteryState()
                      assert(Number(requestId) > 0)
                      assert(lotteryState.toString() == 1)
                  })
              })
              describe("fulfillRandomWords", function () {
                  beforeEach(async function () {
                      await lottery.enterLottery({ value: lotteryEntranceFee })
                      await network.provider.send("evm_increaseTime", [
                          Number(interval) + 1,
                      ])
                      await network.provider.request({
                          method: "evm_mine",
                          params: [],
                      })
                  })
                  it("can only be performed after performUpkeep", async function () {
                      await expect(
                          vrfCoordinatorV2Mock.fulfillRandomWords(
                              0,
                              lottery.target,
                          ),
                      ).to.be.revertedWith("nonexistent request")
                      await expect(
                          vrfCoordinatorV2Mock.fulfillRandomWords(
                              1,
                              lottery.target,
                          ),
                      ).to.be.revertedWith("nonexistent request")
                  })
                  it("picks a winner, resets the lottery, and sends money", async function () {
                      let winnerStartingBalance
                      const additionalEntrants = 3
                      const startingAccountIndex = 1
                      const accounts = await ethers.getSigners()
                      for (
                          let i = startingAccountIndex;
                          i < startingAccountIndex + additionalEntrants;
                          i++
                      ) {
                          const accountConnectedLottery = await lottery.connect(
                              accounts[i],
                          )
                          await accountConnectedLottery.enterLottery({
                              value: lotteryEntranceFee,
                          })
                      }
                      const startingTimeStamp =
                          await lottery.getLatestTimeStamp()

                      await new Promise(async (resolve, reject) => {
                          //   console.log("inside promise")
                          lottery.once("WinnerPicked", async () => {
                              try {
                                  const recentWinner =
                                      await lottery.getRecentWinner()
                                  //   console.log("winner", recentWinner)
                                  //   console.log(accounts[1].address)
                                  //   console.log(accounts[2].address)
                                  //   console.log(accounts[3].address)
                                  const winnerEndingBalance =
                                      await ethers.provider.getBalance(
                                          recentWinner,
                                      )
                                  const lotteryState =
                                      await lottery.getLotteryState()
                                  const endingTimeStamp =
                                      await lottery.getLatestTimeStamp()

                                  const numPlayers =
                                      await lottery.getNumberOfPlayers()
                                  assert.equal(numPlayers.toString(), "0")
                                  assert.equal(lotteryState.toString(), "0")
                                  assert(endingTimeStamp > startingTimeStamp)
                                  assert.equal(
                                      winnerEndingBalance.toString(),
                                      (
                                          winnerStartingBalance +
                                          BigInt(additionalEntrants) *
                                              lotteryEntranceFee +
                                          lotteryEntranceFee
                                      ).toString(),
                                  )
                              } catch (e) {
                                  //   console.log(e)
                                  reject(e)
                              }
                              resolve()
                          })
                          const tx = await lottery.performUpkeep("0x00")
                          //   console.log("performing")
                          winnerStartingBalance =
                              await ethers.provider.getBalance(
                                  accounts[1].address,
                              )

                          //   console.log(accounts[1].getBalance())
                          const txReceipt = await tx.wait(1)
                          console.log(txReceipt)
                          await vrfCoordinatorV2Mock.fulfillRandomWords(
                              txReceipt.logs[1].args.requestId,
                              lottery.target,
                          )
                      })
                  })
              })
          })
      })
