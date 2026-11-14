# 数据模型与未来后端设计

## 1. 设计目标

- 第一版完全运行在浏览器中。
- 每日记录、食物库、用户资料和目标的边界清晰，未来可以拆成后端资源。
- 历史记录保持稳定：食物库被修改或删除后，已经记录的当天数据不能变化。
- 日期、ID、时间戳和版本号适合未来网络传输与同步。
- UI 只通过领域服务和 Repository 访问数据，不直接操作 IndexedDB。

## 2. 领域类型

```ts
type IsoDate = string; // YYYY-MM-DD，设备本地日期
type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

interface Nutrition {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

type FoodCategory =
  | 'protein'
  | 'staple'
  | 'egg_dairy_soy'
  | 'vegetable'
  | 'fruit'
  | 'fat_nut_condiment'
  | 'other';

type FoodBasis = 'raw' | 'dry' | 'as_sold';

/**
 * 语言代码 -> 文本。zh-CN 必须有值，作为兜底。
 * 额外语言不需要提升 schemaVersion。
 */
type LocalizedText = Record<string, string> & {
  'zh-CN': string;
};

interface Food {
  id: string;
  names: LocalizedText;
  category: FoodCategory;
  basis: FoodBasis;
  nutritionPer100g: Nutrition;
  servings: { id: string; label: string; grams: number }[];
  batch?: {
    totalGrams: number;
    portionGrams: number;
    portions?: number;
    components?: {
      foodId?: string;
      names: LocalizedText;
      totalGrams: number;
      nutritionPer100g: Nutrition;
    }[];
    sourceFoodId?: string;
    disposedAt?: string;
  };
  source: 'builtin' | 'custom' | 'imported';
  createdAt: string; // ISO timestamp
  updatedAt: string;
}

interface FoodEntry {
  id: string;
  foodId: string;
  foodNames: LocalizedText; // 名称快照
  amountGrams: number;
  enteredQuantity: number;
  enteredUnit: 'g' | 'serving';
  servingLabel?: string;
  servingGrams?: number;
  nutritionPer100gSnapshot: Nutrition; // 快照
  createdAt: string;
  updatedAt: string;
}

interface DailyLog {
  id: string;
  date: IsoDate;
  meals: Record<MealType, FoodEntry[]>;
  revision: number;
  targetSnapshot?: Nutrition | null;
  weightKgSnapshot?: number | null;
  createdAt: string;
  updatedAt: string;
}

interface UserProfile {
  sex: 'male' | 'female';
  age: number;
  heightCm: number;
  weightKg: number;
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
  goal: 'lose' | 'maintain' | 'gain';
  updatedAt: string;
}

interface TargetSettings {
  mode: 'auto' | 'manual';
  manual: Nutrition | null;
  updatedAt: string;
}
```

## 3. IndexedDB 存储

数据库：`calorie-day`，版本 `2`。保留从 v1 升级时将 `name` / `foodName` 转为
`names` / `foodNames` 的兼容迁移。

内置食物 `seedVersion` 当前为 `1`。检测到旧 seedVersion 时，只删除并重写
`source: "builtin"` 的内置食物，自定义 / 导入食物、日志、个人资料和目标设置不受影响。

| Object store | Key | Value |
| --- | --- | --- |
| `meta` | `'app'` | `{ schemaVersion, seedVersion, createdAt }` |
| `profile` | `'current'` | `UserProfile` |
| `settings` | `'current'` | `TargetSettings` |
| `foods` | `food.id` | `Food` |
| `logs` | `YYYY-MM-DD` | `DailyLog` |

`foods` 有 `by_category` 索引；`logs` 有 `by_updated_at` 索引，为未来趋势查询预留。
名称是多语言对象，因此不创建单值 `by_name` 索引。当前结构版本 2 的迁移会删除旧索引。

## 4. 关键决策

### 4.1 食物条目保存快照

`FoodEntry` 同时保存食物名称映射、每 100g 营养和实际克数。这样：

- 修改食物库、切换界面语言或增加翻译不会改变历史记录的结构。
- 删除食物后，已经记录的数据仍能显示和编辑。
- 后端同步时，历史记录可以独立于食物库存在。
- 快照保留当时可用的全部语言名称，而不只是当前 locale。

### 4.1.1 食物名称本地化

食物名称使用 `names` 映射，而不是单字符串或数据库列：

- `zh-CN` 必须有值并作为兜底，避免任何 locale 下出现空名称。
- 导入格式允许附加任意符合 BCP 47 风格的语言代码，最多 20 个。
- 显示时按“当前 locale → 同语言 → zh-CN → 第一个可用值”回退。
- 搜索会匹配所有语言名称；导入冲突匹配优先使用稳定 `id`，名称匹配使用 `zh-CN` 规范化值。
- 未来后端可以把映射展开成 `food_translations(food_id, locale, name)`，API DTO 仍返回映射，前端无需改展示模型。

### 4.2 克数是统一计量

无论用户按克还是按份输入，最终都换算成 `amountGrams`。份量信息只用于展示和再次编辑。
未来需要统计或接入营养数据库时，统一使用克数最稳定。

### 4.3 日期是本地日期

`date` 使用设备本地日历的 `YYYY-MM-DD`，不通过 UTC 转换生成，避免跨时区/午夜时
记录落到前一天或后一天。

### 4.4 每日记录保存目标和体重快照

`DailyLog` 在首次写入时保存当天的 `targetSnapshot` 和 `weightKgSnapshot`。历史摘要使用
日志自己的快照，而不是当前身体资料。修改体重、活动量或手动目标后，过去的日期保持原目标；
当天已有日志会同步到新目标，没有记录的新日期则使用当前目标。

启动时会为旧日志补齐缺失的快照（使用当时的当前目标），保存资料/目标前也会先冻结已有
日志，再单独刷新当天快照。这样既隔离历史体重变化，又能兼容旧数据。

### 4.5 备餐

备餐不是单独的表，而是一个带 `batch` 元数据的自定义 `Food`。一个备餐代表一组食材：

- `components`：组内每项食材的名称、总克数和每 100g 营养快照。
- `totalGrams`：所有食材的总重量。
- `portions`：总份数；`portionGrams = totalGrams / portions` 自动计算。
- `sourceFoodId`：旧版单项备餐的来源食物（兼容字段）。
- `disposedAt`：剩余部分被确认吃完的时间；存在时剩余量视为 0，不计入摄入。
- 剩余量 = `totalGrams - sum(该 foodId 的所有 FoodEntry.amountGrams)`。
- 剩余量降到 0 或点击「确认吃完」后，备餐会从进行中列表自动移除。

备餐是全局数据，不绑定某一天。记录时可以单独选择日期和餐次，因此支持“今晚做好、
明早吃”的跨天安排。未来日期的记录在当天到达后进入日记。

删除或修改某次记录会自动反映到剩余量，不需要维护额外的库存字段。备餐食物仍可
在食物库编辑或删除；删除备餐不会删除已经记录的饮食快照。

### 4.6 最近选择

最近使用过的食物 ID 存在浏览器 `localStorage`，最多保留 8 个。选择界面按最近使用顺序
置顶，并显示“最近”标记。它属于本机 UI 偏好，不进入业务备份。

### 4.7 修订号

`DailyLog.revision` 从 0 开始。保存时先读取已有记录，若版本不一致则拒绝写入并提示刷新。
IndexedDB 事务在读取、比较、写入、提交之间提供原子性，避免多标签页静默覆盖。

### 4.8 写入后再反馈

UI 不会先把操作视为成功。Repository 的 Promise 只在事务完成后 resolve；之后界面才更新并
显示“已保存”。写入失败时保留编辑内容，提示重试。

## 5. Repository 边界

```ts
interface CalorieRepository {
  initialize(): Promise<void>;
  getProfile(): Promise<UserProfile | null>;
  saveProfile(profile: UserProfile): Promise<UserProfile>;
  saveProfileAndTargetSettings(
    profile: UserProfile,
    settings: TargetSettings,
  ): Promise<void>;
  getTargetSettings(): Promise<TargetSettings>;
  saveTargetSettings(settings: TargetSettings): Promise<TargetSettings>;
  listFoods(): Promise<Food[]>;
  saveFood(food: Food): Promise<Food>;
  saveFoods(foods: Food[]): Promise<Food[]>;
  deleteFood(foodId: string): Promise<void>;
  getDailyLog(date: string): Promise<DailyLog | null>;
  listDailyLogs(fromDate?: string, toDate?: string): Promise<DailyLog[]>;
  getFoodUsage(): Promise<Record<string, number>>;
  saveDailyLog(log: DailyLog): Promise<DailyLog>;
  backfillDailyLogSnapshots(
    target: Nutrition,
    weightKg: number | null,
  ): Promise<void>;
  importBackup(payload: BackupPayload): Promise<BackupImportResult>;
}
```

当前实现：`IndexedDbRepository`。未来新增 `HttpCalorieRepository`，在应用入口替换单例即可。

全量备份使用独立格式：

```ts
interface BackupPayload {
  backupVersion: 1;
  exportedAt: string;
  logsFrom: string | null;
  logsTo: string | null;
  profile: UserProfile | null;
  targetSettings: TargetSettings | null;
  foods: Food[];
  logs: DailyLog[];
}

interface BackupImportResult {
  foodsAdded: number;
  foodsSkipped: number;
  logsAdded: number;
  logsSkipped: number;
  profileImported: boolean;
  settingsImported: boolean;
}
```

导入在单个 IndexedDB 事务中完成，采用“只补充缺失数据”的合并策略：按 ID 保留已有食物，
按日期保留已有日志，已有个人资料和目标设置不被覆盖。导出范围只影响 `logs`；`foods`
始终是完整食物库。

## 6. 未来 API 映射建议

```text
GET    /me/profile
PUT    /me/profile
GET    /me/settings
PUT    /me/settings
GET    /me/foods
POST   /me/foods
PUT    /me/foods/:id
DELETE /me/foods/:id
GET    /me/logs/:date
PUT    /me/logs/:date
GET    /me/backup?from=YYYY-MM-DD&to=YYYY-MM-DD
POST   /me/backup/merge
```

`PUT /me/logs/:date` 建议接收完整 `DailyLog`（不含 `revision` 由服务端生成）或使用
`If-Match` / 客户端 revision 做乐观锁。服务端返回提交后的记录。

食物接口返回的 `names` 是语言映射；服务端内部可以规范化为 translation 表，但响应
保持 `names` 形式。`DailyLog` 中的 `foodNames` 是记录时快照，不应由服务端重新翻译。

## 7. 推荐值计算

```text
BMR = 10 × 体重kg + 6.25 × 身高cm − 5 × 年龄 + 性别偏移
女性偏移 = −161，男性偏移 = +5

TDEE = BMR × 活动系数
目标热量 = round10(TDEE × 目标系数)

蛋白质 = round(体重kg × 活动蛋白质系数)
脂肪 = round(目标热量 × 0.25 / 9)
碳水 = round(max(0, (目标热量 − 蛋白质×4 − 脂肪×9) / 4))
```

活动蛋白质系数：

| 活动量 | 系数 |
| --- | --- |
| 久坐少动 | 1.0g/kg |
| 轻度活动 | 1.2g/kg |
| 中度活动 | 1.4g/kg |
| 高度活动 | 1.6g/kg |
| 极高活动 | 1.8g/kg |

手动模式直接使用用户填写的四项目标。

## 8. 分享数据

分享图不单独持久化。生成时从当前选中日期的 `DailyLog` 和当前目标实时派生：

- 全天热量、推荐热量、剩余/超出
- 碳水/蛋白/脂肪摄入与推荐
- 宏量供能占比（4/4/9）
- 四餐小计和每条食物分量

## 9. 未来扩展时会保留的兼容点

- 新增 `cooked` 基准：扩展 `FoodBasis`，旧数据不受影响。
- 计划摄入：新增独立的计划数据类型和 Repository 方法，不污染实际日志。
- 趋势：利用 `logs` 的日期主键和 `by_updated_at` 索引，按范围读取。
- 云同步：所有实体有稳定 ID 和 ISO 时间戳；每日日志有 revision。
- 导入格式：使用 `schemaVersion` 显式版本化；当前 v1 支持多语言名称，不保留旧版 `name` 字符串格式兼容。
- 全量备份：`backupVersion` 独立版本化，包含食物库、指定日期范围的日志、资料与目标；当前为 v1。
- 多语言名称：新增语言只需要补充数据中的 `names`，不需要修改食物结构或导入版本。

## 10. 已知未覆盖项

- 全量备份导入采用安全合并，不提供覆盖同日期记录或在已安装设备上完整替换的选项。
- 多标签页对食物库的编辑没有 revision 冲突保护；每日记录有。
- 备餐创建后暂不支持直接修改总重量/总份数，需要删除后重新创建。
- 最近食物只保存在本机 localStorage，不参与跨设备同步。
- 食物名称编辑界面目前只编辑 `zh-CN`；导入的其他语言名称会保留，但还没有逐语言编辑 UI。
- 份量名称（如“个”“杯”）仍是单语言字符串，尚未纳入名称映射。
