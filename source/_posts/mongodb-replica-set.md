---
title: 使用 Replica Set 实现 MongoDB 高可用
date: 2018-05-03 12:00:00
tags: MongoDB
---

![](/img/mongodb.svg)

使用MongoDB，可以以单机模式提供服务。但在实际的生产环境中，单机模式将面临很大的风险，一旦单点数据库服务出现故障，就会导致服务调用出现错误甚至崩溃。因此，在实际生产环境下，需要对MongoDB做相应的主备处理，提高数据库服务的可用性。

<!-- more -->

对于提高可用性，一些博文里提到了使用[主从模式（master-slaver）](https://docs.mongodb.com/manual/core/master-slave/)。

> WARNING:
Deprecated since version 3.2: MongoDB 3.2 deprecates the use of master-slave replication for components of sharded clusters.

主从模式是高可用的一种方案。**然而上面这段警告里提到，在高版本的MongoDB（3.2以上）的一些场景中，官方已经不推荐使用主从模式，取而代之的，是使用复制集（Replica Set）的方式做主备处理。**

> IMPORTANT:
Replica sets replace master-slave replication for most use cases. If possible, use replica sets rather than master-slave replication for all new production deployments. This documentation remains to support legacy deployments and for archival purposes only.

因此，本文将介绍如何将单机MongoDB数据库拓展为主备模式的复制集，以提高可用性。

## 1. 复制集 Replica Set
在复制集中，有且只有一个主节点(primary)，可以包含一个或多个从节点(secondary)，主从节点通过心跳检测来确定节点是否健康或存活。所有的读写操作都是在主节点上进行的，如果要实现读写分离，需要进行相应的处理。从节点会根据oplog来复制主节点的数据。

![MongoDB复制集](/img/163266184cbe4acd.png)

除了主从节点外，MongoDB的复制集中还存在着一种叫仲裁者(Arbiter)的角色。一个仲裁者节点是比较轻量级的，它不会去复制主库的数据，因此也就不会成为主节点；它是在投票选举阶段起作用的——当主节点故障时，仲裁者可以进行投票。一般来说，不建议一个复制集中包含超过一个仲裁者。

当主节点突然故障后，MongoDB有自己的机制，会自动切换，通过选举，在从节点中选出一个节点作为新的主节点。

![MongoDB复制集故障处理](/img/163266184cd3012c.png)

## 2. 如何使用复制集
### 2.1. 创建复制集
首先，需要在MongoDB实例的启动参数中加入replSet，指定复制集的名称。

```bash
mongod --port 8017 --dbpath /home/work/data/db1 --replSet rstest
```

对于已有的单机实例，也可以加入该参数并进行重启。此外，我们还需要另外启动两个MongoDB实例作为从节点，注意replSet参数指定的名称需要相同。

```bash
mongod --port 8016 --dbpath /home/work/data/db2 --replSet rstest
mongod --port 8015 --dbpath /home/work/data/db2 --replSet rstest
```

然后，可以通过mongo命令连接MongoDB服务，进入主节点进行初始化。

```bash
mongo 127.0.0.1:8017
```

```javascript
rs.initiate({
  _id:"rstest", // replSet指定的名称
  members:[{
    _id:0,
    host:"127.0.0.1:8017" // 主节点ip与端口
  }]
})
```
需要注意的是，如果是将已有单机拓展为复制集，要在连接原单机的实例并在其中运行使其作为主节点。

最后，再将其他两个从节点加入到该复制集中。

```javascript
rs.add("127.0.0.1:8016")
rs.add("127.0.0.1:8015")
```

通过`rs.status()`查看效果，可以看到`rstest`这个复制集中已经有了三个节点，`stateStr `指明了节点的类型，`health`为1表明该节点是健康的。

```javascript
{
    "set" : "rstest",
    "date" : ISODate("2017-10-31T13:04:16.704Z"),
    "myState" : 1,
    "members" : [
        {
            "_id" : 0,
            "name" : "127.0.0.1:8017",
            "health" : 1,
            "state" : 1,
            "stateStr" : "PRIMARY", // 节点的类型，主节点
            "uptime" : 1508,
            "optime" : Timestamp(1509455043, 1),
            "optimeDate" : ISODate("2017-10-31T13:04:03Z"),
            "electionTime" : Timestamp(1509454568, 2),
            "electionDate" : ISODate("2017-10-31T12:56:08Z"),
            "configVersion" : 3,
            "self" : true
        },
        {
            "_id" : 1,
            "name" : "127.0.0.1:8016",
            "health" : 1,
            "state" : 2,
            "stateStr" : "SECONDARY",
            "uptime" : 25,
            "optime" : Timestamp(1509455043, 1),
            "optimeDate" : ISODate("2017-10-31T13:04:03Z"),
            "lastHeartbeat" : ISODate("2017-10-31T13:04:15.657Z"),
            "lastHeartbeatRecv" : ISODate("2017-10-31T13:04:15.108Z"),
            "pingMs" : 0,
            "syncingTo" : "127.0.0.1:8017",
            "configVersion" : 3
        },
        {
            "_id" : 2,
            "name" : "127.0.0.1:8015",
            "health" : 1,
            "state" : 2,
            "stateStr" : "SECONDARY",
            "uptime" : 13,
            "optime" : Timestamp(1509455043, 1),
            "optimeDate" : ISODate("2017-10-31T13:04:03Z"),
            "lastHeartbeat" : ISODate("2017-10-31T13:04:15.657Z"),
            "lastHeartbeatRecv" : ISODate("2017-10-31T13:04:15.661Z"),
            "pingMs" : 0,
            "configVersion" : 3
        }
    ],
    "ok" : 1
}
```

### 2.2. 连接复制集
由于复制集存在灾备时中的切换机制，在主节点故障的情况下，集群内其他从节点会通过投票方式产生新的主节点，因此，不能像单机情况下那样，直接连接主节点。否则，在MongoDB复制集中主节点故障，自动切换主节点时，数据库访问就会出问题。因此连接复制集需要特定的连接方式。

在MongoDB的连接字符串(connection url)中可以进行指定。

```
mongodb://[username:password@]host1[:port1][,host2[:port2],...[,hostN[:portN]]][/[database][?options]]
```

其中可以指定多个host:port，用英文逗号连接，并在最后的option中支持replicaSet参数，用于指定连接的复制集。例如：

```
mongodb://127.0.0.1:8017,127.0.0.1:8016,127.0.0.1:8015/books?replicaSet=rstest
```

这样就可以连接上复制集中的books这个数据库。

## 3. 总结
MongoDB复制集的故障机制切换是它自身来保障，在部署好上面一系列的服务后，我们可以测试一下当主节点故障时，集群中的节点状态与服务可用性。

通过kill主节点MongoDB进程，使用`rs.status()`可以发现，其中一个从节点已经升级为了主节点（这部分在从节点的日志中也有体现）。此外，数据查询依然可以进行，不会因为主节点的宕机而导致数据服务不可用。