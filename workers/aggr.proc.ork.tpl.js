'use strict'

const async = require('async')
const WrkBase = require('tether-wrk-base/workers/base.wrk.tether')

class WrkProcAggr extends WrkBase {
  constructor (conf, ctx) {
    super(conf, ctx)

    if (!ctx.cluster) {
      throw new Error('ERR_PROC_RACK_UNDEFINED')
    }

    this.prefix = `${this.wtype}-${ctx.cluster}`
  }

  init () {
    super.init()

    this.mem = {}
  }

  debugError (data, e, alert = false) {
    if (alert) {
      return console.error(`[ORK/${this.ctx.cluster}]`, data, e)
    }
    this.logger.debug(`[ORK/${this.ctx.cluster}]`, data, e)
  }

  async registerRack (req) {
    if (!req.id) {
      throw new Error('ERR_RACK_ID_INVALID')
    }

    if (!req.type) {
      throw new Error('ERR_RACK_TYPE_INVALID')
    }

    const info = req.info

    if (!info.rpcPublicKey) {
      throw new Error('ERR_RACK_INFO_RPC_PUBKEY_INVALID')
    }

    await this._registerRackHook0(req)

    await this.racks.put(
      req.id,
      req
    )

    return 1
  }

  async forgetRacks (req) {
    const stream = this.racks.createReadStream()
    let cnt = 0

    for await (const data of stream) {
      const entry = data.value

      let valid = false

      if (Array.isArray(req.ids)) {
        if (req.ids.includes(entry.id)) {
          valid = true
        }
      }

      if (req.all) {
        valid = true
      }

      if (valid) {
        await this.racks.del(entry.id)
        cnt++
      }
    }

    return cnt
  }

  async listRacks (req) {
    if (req.type && typeof req.type !== 'string') {
      throw new Error('ERR_TYPE_INVALID')
    }

    const stream = this.racks.createReadStream()
    const res = []

    for await (const data of stream) {
      const entry = data.value

      if (!req.type || entry.type.startsWith(req.type)) {
        res.push(entry)
      }
    }

    if (!req.keys) {
      return res.map(entry => {
        delete entry.info.rpcPublicKey
        return entry
      })
    }

    return res
  }

  async tailLog (req) {
    if (!req.type) {
      throw new Error('ERR_TYPE_INVALID')
    }

    const stream = this.racks.createReadStream()
    const racks = []

    for await (const data of stream) {
      const entry = data.value

      if (entry.type === req.type || entry.type.startsWith(`${req.type}-`)) {
        racks.push(entry)
      }
    }

    const res = Array.prototype.concat.apply(
      [],
      await async.mapLimit(racks, 25, async rack => {
        try {
          return await this.net_r0.jRequest(
            rack.info.rpcPublicKey,
            'tailLog',
            req, { timeout: 10000 }
          )
        } catch (e) {
          this.debugError(`tailLog ${rack.id} type:${req.type} key:${req.key} tag:${req.tag}`, e, true)
          return []
        }
      })
    )

    res.sort((a, b) => {
      return a.ts - b.ts
    })

    return res
  }

  _start (cb) {
    async.series([
      next => { super._start(next) },
      async () => {
        const rpcServer = this.net_r0.rpcServer

        this.racks = await this.store_s0.getBee(
          { name: 'racks' },
          { keyEncoding: 'utf-8', valueEncoding: 'json' }
        )

        await this.racks.ready()

        rpcServer.respond('registerRack', async (req) => {
          return await this.net_r0.handleReply('registerRack', req)
        })

        rpcServer.respond('forgetRacks', async (req) => {
          return await this.net_r0.handleReply('forgetRacks', req)
        })

        rpcServer.respond('listRacks', async (req) => {
          return await this.net_r0.handleReply('listRacks', req)
        })

        rpcServer.respond('tailLog', async (req) => {
          return await this.net_r0.handleReply('tailLog', req)
        })
      }
    ], cb)
  }

  async _registerRackHook0 (req) {
    // no-op
  }
}

module.exports = WrkProcAggr
