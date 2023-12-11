# Packet

## Protocol

the below ascii diagram(generated by [protocol](https://github.com/luismartingarcia/protocol)) shows the structure of a message.

### Request Packet

```sh
> ./protocol --bits 32 "proto ver:8,type:8,requestId:64,codec:8,methodLen:32,headerLen:32,contentLen:32,method+header+content...:104"
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|   proto ver   |      type     |                               |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+                               +
|                           requestId                           |
+                               +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                               |     codec     |               |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                   methodLen                   |               |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                   headerLen                   |               |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                   contentLen                  |               |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+               +
|                                                               |
+                                                               +
|                    method+header+content...                   |
+                                                               +
|                                                               |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
```

1. proto ver: protocol version, 8 bits
2. type: message type, 8 bits, 0: request, 1: notification, 2: response, 3: heartbeat
3. requestId: request id, 64 bits
4. codec: codec type, 8 bits, 0: text, 1: binary(currently using fury) 2. json
5. methodLen: method length, 32 bits(varint)
6. headerLen: header length, 32 bits(varint)
7. contentLen: content length, 32 bits(varint)
8. method: method name, methodLen bytes
9. header: header, headerLen bytes
10. content: content, contentLen bytes

notice, there is a difference bewteen the design and the reality, methodLen and method are stored in the silbling bytes, so are headerLen and header, contentLen and content.

The header is a json string, it contains some metadata of the message, such as the transfer encoding, chunk size, etc.

### Response Packet

```sh
> ./protocol --bits 32 "proto ver:8,type:8,requestId:64,codec:8,respstatus:16,headerLen:32,contentLen:32,header+content...:88"
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|   proto ver   |      type     |                               |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+                               +
|                           requestId                           |
+                               +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                               |     codec     |   respstatus  |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|               |                   headerLen                   |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|               |                   contentLen                  |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|               |                                               |
+-+-+-+-+-+-+-+-+                                               +
|                                                               |
+                       header+content...                       +
|                                                               |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
```