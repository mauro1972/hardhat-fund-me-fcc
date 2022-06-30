const { deployments, ethers, getNamedAccounts } = require("hardhat")
const { assert, expect } = require("chai")

describe("FundMe", async function () {
  let fundMe
  let deployer
  let mockV3Aggregator
  const sendValue = ethers.utils.parseEther("1")

  beforeEach(async function () {
    deployer = (await getNamedAccounts()).deployer
    await deployments.fixture(["all"])
    fundMe = await ethers.getContract("FundMe", deployer)
    mockAggregator = await ethers.getContract("MockV3Aggregator", deployer)
  })

  describe("constructor", async function () {
    it("sets the aggregator address correctly", async () => {
      const response = await fundMe.getPriceFeed()
      assert.equal(response, mockAggregator.address)
    })
  })

  describe("fund", async function () {
    it("Fail if tou not send enoughETH", async function () {
      await expect(fundMe.fund()).to.be.revertedWith(
        "You need to spend more ETH!"
      )
    })

    it("updated the amount funded data structure", async function () {
      await fundMe.fund({ value: sendValue })
      const response = await fundMe.getAddressToAmountFunded(deployer)
      assert.equal(response.toString(), sendValue.toString())
    })

    it("Adds funder to array of funders", async function () {
      await fundMe.fund({ value: sendValue })
      const funder = await fundMe.getFunder(0)
      assert.equal(funder, deployer)
    })
  })

  describe("withdraw", async function () {
    beforeEach(async function () {
      await fundMe.fund({ value: sendValue })
    })

    it("withdraw ETH from a single founder", async function () {
      //Arrange
      const startingFundMeBalance = await fundMe.provider.getBalance(
        fundMe.address
      )
      const startingDeployerBalance = await fundMe.provider.getBalance(deployer)
      // Act
      const txResponse = await fundMe.withdraw()
      const txReceipt = await txResponse.wait(1)

      const { gasUsed, effectiveGasPrice } = txReceipt
      const gasCost = gasUsed.mul(effectiveGasPrice)

      const endingFundMeBalance = await fundMe.provider.getBalance(
        fundMe.address
      )
      const endingDeployerBalance = await fundMe.provider.getBalance(deployer)
      // gasCost
      // Assert
      assert.equal(endingFundMeBalance, 0)
      assert.equal(
        startingFundMeBalance.add(startingDeployerBalance).toString(),
        endingDeployerBalance.add(gasCost).toString()
      )
    })

    it("allows us to withdraw with multiple funders", async function () {
      // Arrange
      const accounts = await ethers.getSigners()
      for (let i = 1; i < 6; i++) {
        const fundMeConnectContract = await fundMe.connect(accounts[i])
        await fundMeConnectContract.fund({ value: sendValue })
      }
      const startingFundMeBalance = await fundMe.provider.getBalance(
        fundMe.address
      )
      const startingDeployerBalance = await fundMe.provider.getBalance(deployer)

      // Act
      const txResponse = await fundMe.withdraw()
      const txReceipt = await txResponse.wait(1)

      const { gasUsed, effectiveGasPrice } = txReceipt
      const gasCost = gasUsed.mul(effectiveGasPrice)

      const endingFundMeBalance = await fundMe.provider.getBalance(
        fundMe.address
      )
      const endingDeployerBalance = await fundMe.provider.getBalance(deployer)

      // Assert
      assert.equal(endingFundMeBalance, 0)
      assert.equal(
        startingFundMeBalance.add(startingDeployerBalance).toString(),
        endingDeployerBalance.add(gasCost).toString()
      )

      // Make sure the funders are reser properly
      await expect(fundMe.getFunder(0)).to.be.reverted

      for (i = 0; i < 6; i++) {
        assert.equal(
          await fundMe.getAddressToAmountFunded(accounts[i].address),
          0
        )
      }
    })

    it("Only allows the owner to withdraw", async function () {
      const accounts = await ethers.getSigners()
      const attacker = accounts[1]
      const attackerConnectedContract = await fundMe.connect(attacker)
      await expect(attackerConnectedContract.withdraw()).to.be.revertedWith(
        "FundMe__NotOwner"
      )
    })
  })
})
