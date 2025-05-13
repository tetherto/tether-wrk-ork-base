'use strict'

const test = require('brittle')
const sinon = require('sinon')
const WrkProcAggr = require('../workers/aggr.proc.ork.tpl.js')

function createWrk () {
  const wrk = new WrkProcAggr({}, { cluster: 'test-cluster' })
  wrk.racks = {
    put: sinon.stub().resolves(),
    del: sinon.stub().resolves(),
    createReadStream: sinon.stub().returns([]),
    ready: sinon.stub().resolves()
  }
  wrk.net_r0 = {
    jRequest: sinon.stub().resolves([]),
    rpcServer: { respond: sinon.stub() },
    handleReply: sinon.stub()
  }
  wrk.store_s0 = {
    getBee: sinon.stub().resolves(wrk.racks)
  }
  wrk.logger = { debug: sinon.stub() }
  return wrk
}

test('constructor: throws if cluster is missing', t => {
  t.exception(() => new WrkProcAggr({}, {}), /ERR_PROC_RACK_UNDEFINED/)
})

test('registerRack: stores rack', async t => {
  const wrk = createWrk()
  const rack = { id: 'id1', type: 'server', info: { rpcPublicKey: 'pubkey1' } }
  const res = await wrk.registerRack(rack)
  t.is(res, 1)
  t.is(wrk.racks.put.callCount, 1)
  t.alike(wrk.racks.put.getCall(0).args, ['id1', rack])
})

test('registerRack: throws if id missing', async t => {
  const wrk = createWrk()
  await t.exception(() => wrk.registerRack({ type: 'server', info: { rpcPublicKey: 'pubkey1' } }), /ERR_RACK_ID_INVALID/)
})

test('registerRack: throws if type missing', async t => {
  const wrk = createWrk()
  await t.exception(() => wrk.registerRack({ id: 'id1', info: { rpcPublicKey: 'pubkey1' } }), /ERR_RACK_TYPE_INVALID/)
})

test('registerRack: throws if rpcPublicKey missing', async t => {
  const wrk = createWrk()
  await t.exception(() => wrk.registerRack({ id: 'id1', type: 'server', info: {} }), /ERR_RACK_INFO_RPC_PUBKEY_INVALID/)
})

test('listRacks: returns all racks', async t => {
  const wrk = createWrk()
  wrk.racks.createReadStream.returns([
    { value: { id: 'id1', type: 'server', info: { rpcPublicKey: 'pubkey1' } } }
  ])
  const res = await wrk.listRacks({})
  t.alike(res, [{ id: 'id1', type: 'server', info: {} }])
})

test('listRacks: returns racks with keys if requested', async t => {
  const wrk = createWrk()
  wrk.racks.createReadStream.returns([
    { value: { id: 'id1', type: 'server', info: { rpcPublicKey: 'pubkey1' } } }
  ])
  const res = await wrk.listRacks({ keys: true })
  t.alike(res, [{ id: 'id1', type: 'server', info: { rpcPublicKey: 'pubkey1' } }])
})

test('listRacks: filters by type', async t => {
  const wrk = createWrk()
  wrk.racks.createReadStream.returns([
    { value: { id: 'id1', type: 'server', info: { rpcPublicKey: 'pubkey1' } } },
    { value: { id: 'id2', type: 'client', info: { rpcPublicKey: 'pubkey2' } } }
  ])
  const res = await wrk.listRacks({ type: 'server' })
  t.alike(res, [{ id: 'id1', type: 'server', info: {} }])
})

test('listRacks: throws if type is not string', async t => {
  const wrk = createWrk()
  await t.exception(() => wrk.listRacks({ type: 123 }), /ERR_TYPE_INVALID/)
})

test('tailLog: aggregates and returns logs', async t => {
  const wrk = createWrk()
  wrk.racks.createReadStream.returns([
    { value: { id: 'id1', type: 'server', info: { rpcPublicKey: 'pubkey1' } } }
  ])
  const logs = [
    { ts: 1, log: 'Log entry 1 from rack1' },
    { ts: 2, log: 'Log entry 2 from rack1' }
  ]
  wrk.net_r0.jRequest.resolves(logs)
  const res = await wrk.tailLog({ type: 'server' })
  t.alike(res, logs)
  t.is(wrk.net_r0.jRequest.callCount, 1)
})

test('tailLog: throws if type missing', async t => {
  const wrk = createWrk()
  await t.exception(() => wrk.tailLog({}), /ERR_TYPE_INVALID/)
})

test('tailLog: handles jRequest error and logs', async t => {
  const wrk = createWrk()
  wrk.racks.createReadStream.returns([
    { value: { id: 'id1', type: 'server', info: { rpcPublicKey: 'pubkey1' } } }
  ])
  wrk.net_r0.jRequest.rejects(new Error('fail'))

  const orig = console.error
  let called = false
  console.error = () => { called = true }

  const res = await wrk.tailLog({ type: 'server' })
  t.alike(res, [])
  t.ok(called)

  console.error = orig
})

test('forgetRacks: deletes all racks', async t => {
  const wrk = createWrk()
  wrk.racks.createReadStream.returns([
    { value: { id: 'id1', type: 'server' } }
  ])
  wrk.racks.del.resolves()
  const res = await wrk.forgetRacks({ all: true })
  t.is(res, 1)
  t.is(wrk.racks.del.callCount, 1)
  t.is(wrk.racks.del.getCall(0).args[0], 'id1')
})

test('forgetRacks: deletes only specified ids', async t => {
  const wrk = createWrk()
  wrk.racks.createReadStream.returns([
    { value: { id: 'id1', type: 'server' } },
    { value: { id: 'id2', type: 'server' } }
  ])
  wrk.racks.del.resolves()
  const res = await wrk.forgetRacks({ ids: ['id2'] })
  t.is(res, 1)
  t.is(wrk.racks.del.callCount, 1)
  t.is(wrk.racks.del.getCall(0).args[0], 'id2')
})

test('debugError: logs to console.error if alert', t => {
  const wrk = createWrk()
  const orig = console.error
  const calls = []
  console.error = (...args) => calls.push(args)
  wrk.debugError('data', new Error('fail'), true)
  t.ok(calls.length > 0)
  console.error = orig
})

test('debugError: logs to logger.debug if not alert', t => {
  const wrk = createWrk()
  wrk.logger.debug = sinon.stub()
  wrk.debugError('data', new Error('fail'), false)
  t.is(wrk.logger.debug.callCount, 1)
})
