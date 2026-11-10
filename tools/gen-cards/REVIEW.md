# 题库人工抽查流程

机械校验只能挡住结构错误、重复和明显废选项，知识错误必须人工核对。

## 抽查规则

- 每个 topic 至少抽 1 张，不是每个 deck 抽 1 张。
- `syllabus.json` 的 `_calcTopics` 全部逐张检查。
- 每次只问一句：**“这条知识我敢拿它去考试吗？”**
- 不敢：删除对应卡文件，再用 `--force` 重跑该 topic。
- 连续 3 批抽查通过率高于 90%，才可把普通 topic 的抽查比例降到 1/3；计算类永远全查。

运行下列命令后，打开 `out/review-queue.md` 逐屏检查：

```bash
node tools/gen-cards/validate.mjs
```

## 批次记录

| 批次 | 日期 | deck | 生成数 | 校验通过 | 抽查数 | 抽查发现错误 | 处理 |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| 待填写 | - | - | 0 | 0 | 0 | 0 | - |

## 发布热更新

```bash
node tools/gen-cards/merge.mjs --deck ds
node tools/gen-cards/publish.mjs --out dist/
```

`publish.mjs` 只生成本地文件，不上传、不读取任何部署 token。上传 `dist/` 后，把
`manifest.json` 的公开 HTTPS 地址填进 App 的“题库更新”页。
