'use strict'

const Worker = require('../workers/aggr.proc.ork.tpl.js')
const path = require('path')
const tmp = require('test-tmp')
const { test, hook } = require('brittle')
const RPC = require('@hyperswarm/rpc')
const sinon = require('sinon')

let wrk = null
let rpc = null

async function rpcReq (pubKey, met, data) {
  const buf = Buffer.from(JSON.stringify(data))
  const res = await rpc.request(pubKey, met, buf)

  return JSON.parse(res.toString())
}

hook('setup hook', async function (t) {
  const dir = await tmp(t)
  rpc = new RPC()

  wrk = new Worker(
    {},
    {
      env: 'test',
      tmpdir: path.resolve(dir, '.'),
      root: path.resolve(__dirname, '..'),
      wtype: 'tether-wrk-ork-base',
      cluster: 1
    }
  )
  wrk.init()

  await new Promise((resolve) => wrk.start(resolve))
})

test('ping test', async function (t) {
  const pubKey = wrk.getRpcKey()

  const res = await rpcReq(pubKey, 'ping', 'hello world')
  t.is(res, 'hello world')
})

test('registerRack test', async function (t) {
  const pubKey = wrk.getRpcKey()

  const res = await rpcReq(pubKey, 'registerRack', {
    id: '12345',
    type: 'server',
    info: {
      rpcPublicKey: 'rpc-pub-key-1'
    }
  })
  t.is(res, 1)
})

test('listRacks test', async function (t) {
  const pubKey = wrk.getRpcKey()
  const res = await rpcReq(pubKey, 'listRacks', {})

  const expRes = [{ id: '12345', type: 'server', info: {} }]
  t.alike(res, expRes)
})

test('tailLog test', async function (t) {
  const pubKey = wrk.getRpcKey()

  // Stub the jRequest method
  const jReqStub = sinon.stub(wrk.net_r0, 'jRequest')
  const logs = [
    { ts: 1, log: 'Log entry 1 from rack1' },
    { ts: 2, log: 'Log entry 2 from rack1' }
  ]

  // Define the behavior of the stub
  jReqStub.withArgs('rpc-pub-key-1', 'tailLog', sinon.match.any, sinon.match.any).resolves(logs)

  const res = await rpcReq(pubKey, 'tailLog', {
    type: 'server'
  })

  t.alike(res, logs)
})

test('forgetRacks test', async function (t) {
  const pubKey = wrk.getRpcKey()
  const res = await rpcReq(pubKey, 'forgetRacks', {
    all: true
  })

  t.alike(res, 1)
})

hook('teardown hook', async function (t) {
  await new Promise((resolve) => wrk.stop(resolve))
  await rpc.destroy()
})
