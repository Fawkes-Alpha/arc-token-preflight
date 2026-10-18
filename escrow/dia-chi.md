# AgentEscrow — bang chung tren Arc mainnet

Giu file nay. Day la toan bo so lieu can dan vao ho so Microgrants 2.

## Contract

| | |
|---|---|
| Dia chi | `0xd7589da91061f2f27ac118b22fcc3822f569359c` |
| Mang | Arc mainnet, chainId 5042 |
| Khoi deploy | 26576946 |
| Ma giao dich deploy | `0x58d79434c552b92f548726a735c4cbb4ce67674092fb8ded546fcd592c8455d3` |
| Gas da dung | 837.070 |
| Chi phi | 0,01757847 USDC |
| Kich thuoc ma tren chuoi | 3.627 byte |

Explorer:
- Contract: https://explorer.arc.io/address/0xd7589da91061f2f27ac118b22fcc3822f569359c
- Deploy tx: https://explorer.arc.io/tx/0x58d79434c552b92f548726a735c4cbb4ce67674092fb8ded546fcd592c8455d3

## Bien dich

| | |
|---|---|
| solc | 0.8.20+commit.a1b79de6 |
| Toi uu hoa | bat, runs = 200 |
| evmVersion | paris |

Tai sao `paris` chu khong phai ban moi hon: tranh opcode `PUSH0` cua Shanghai,
phong truong hop EVM cua Arc chua ho tro. An toan hon, khong mat gi.

## Vi dung trong demo

| Vai | Dia chi |
|---|---|
| Client (nguoi thue, cung la nguoi deploy) | `0x5dDCCf94A400341d243f01002f2003aD3100D314` |
| Provider (nguoi lam) | `0x170937d0755B93E2C1f5cA944708b7107c035B23` |

## So lieu do duoc tren mainnet

| | |
|---|---|
| Thoi gian 1 block | **0,506 giay** (do tren 1000 block, block 26.576.000-ish) |
| REVIEW_BLOCKS = 5000 | **~42 phut** |

## Ghi chu ve phi mang

Luc deploy, phi mang la **21 Gwei** — sat ngay tren muc day 20 Gwei trong tai lieu Arc.
Muc day do dang co hieu luc that. Giao dich dat phi thap hon se bi mempool loai bo
am tham: khong loi, khong bien lai.

## Giao dich USDC that tren mainnet

| Buoc | Ket qua | Gas | Chi phi (USDC) | Ma giao dich |
|---|---|---|---|---|
| `createJob` (0,1 USDC vao) | Funded | — | — | `0xe3d9057421e48c64c28c5f8d4dfc0af162238f588f4104b7e993a1186b516123` |
| `submitWork` | Submitted | 36.034 | 0,000757 | `0x1b8865e90fd71c1d3ff467463fa8108fbc3179f9cc4ff3b2276b5724a2ac4961` |
| `approve` (0,1 USDC ra) | **Approved** | 67.961 | 0,001427 | `0x457eb9a15f856b1dba7bbb36934dccfd0dcf125417529bf2340dd745f4ef31f9` |

Sau buoc cuoi: USDC con lai trong contract = **0**. Tien da sang vi provider.

Vong day du: client khoa 0,1 USDC -> provider bao da xong -> client duyet -> tien chay sang provider.
Tat ca tren Arc mainnet, tien that.

Job #1: client `0x5dDCCf94…0D314`, provider `0x170937d0…35B23`, 0,1 USDC,
deadline khoi 26.591.382.

Explorer: https://explorer.arc.io/tx/0xe3d9057421e48c64c28c5f8d4dfc0af162238f588f4104b7e993a1186b516123

## Loi da gap va cach sua (ghi lai cho README)

**App gui deadline tuong doi thay vi tuyet doi.**
O nhap ghi "blocks from now" nhung app truyen thang so do vao `createJob`,
trong khi contract doi so khoi tuyet doi. MetaMask mo phong truoc va bao
`Custom error: 0xbec00580` = `DeadlineInPast()`.

Chot `DeadlineInPast` duoc them vao o vong soat code thu hai. Khong co no,
giao dich se THANH CONG va tao ra mot job chet: qua han ngay tu giay dau,
provider khong nop viec duoc, 0,1 USDC ket trong vong lap vo nghia.
