begin;

-- ============================================================
-- POS INTEGRATION V1-A
-- CHONGQING EXTERNAL API FOUNDATION
-- ============================================================


-- ============================================================
-- 1. EXTERNAL BRANCH CACHE
-- ============================================================

create table public.pos_external_branches (
  id uuid
    primary key
    default gen_random_uuid(),

  organization_id uuid
    not null
    references public.organizations(id)
    on delete restrict,

  provider text
    not null
    default 'CHONGQING',

  external_branch_id bigint
    not null,

  name text
    not null,

  address text,

  phone_number text,

  external_status integer,

  raw_payload jsonb
    not null
    default '{}'::jsonb,

  last_synced_at timestamptz
    not null
    default now(),

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  constraint pos_external_branches_provider_chk
    check (
      provider in (
        'CHONGQING'
      )
    ),

  constraint pos_external_branches_name_chk
    check (
      btrim(name) <> ''
    ),

  unique (
    organization_id,
    provider,
    external_branch_id
  )
);


create index
pos_external_branches_lookup_idx
on public.pos_external_branches (
  organization_id,
  provider,
  name
);


create trigger pos_external_branches_set_updated_at
before update
on public.pos_external_branches
for each row
execute function public.set_updated_at();


-- ============================================================
-- 2. BRANCH → OUTLET MAPPING
-- ============================================================

create table public.pos_branch_mappings (
  id uuid
    primary key
    default gen_random_uuid(),

  organization_id uuid
    not null
    references public.organizations(id)
    on delete restrict,

  provider text
    not null
    default 'CHONGQING',

  external_branch_id bigint
    not null,

  external_branch_name text
    not null,

  outlet_id uuid
    not null
    references public.outlets(id)
    on delete restrict,

  is_active boolean
    not null
    default true,

  created_by uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  constraint pos_branch_mappings_provider_chk
    check (
      provider in (
        'CHONGQING'
      )
    ),

  unique (
    organization_id,
    provider,
    external_branch_id
  ),

  unique (
    organization_id,
    provider,
    outlet_id
  )
);


create index
pos_branch_mappings_outlet_idx
on public.pos_branch_mappings (
  outlet_id,
  is_active
);


create trigger pos_branch_mappings_set_updated_at
before update
on public.pos_branch_mappings
for each row
execute function public.set_updated_at();


-- ============================================================
-- 3. NORMALIZED ORDERS
-- ============================================================

create table public.pos_orders (
  id uuid
    primary key
    default gen_random_uuid(),

  organization_id uuid
    not null
    references public.organizations(id)
    on delete restrict,

  outlet_id uuid
    not null
    references public.outlets(id)
    on delete restrict,

  provider text
    not null
    default 'CHONGQING',

  external_order_id bigint
    not null,

  external_branch_id bigint
    not null,

  order_code text,

  order_type text,

  table_number text,

  customer_name text,

  status text,

  payment_status text,

  payment_method text,

  pax numeric,

  promo_discount numeric
    not null
    default 0,

  ppn numeric
    not null
    default 0,

  service_charge numeric
    not null
    default 0,

  rounding_value numeric
    not null
    default 0,

  total_price numeric
    not null
    default 0,

  amount_paid numeric
    not null
    default 0,

  is_void boolean
    not null
    default false,

  void_reason text,

  void_time_raw text,

  void_by_raw text,

  void_manager_by_raw text,

  pos_user_id bigint,

  business_date date
    not null,

  external_created_at timestamptz,

  external_updated_at timestamptz,

  raw_payload jsonb
    not null
    default '{}'::jsonb,

  last_synced_at timestamptz
    not null
    default now(),

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  constraint pos_orders_provider_chk
    check (
      provider in (
        'CHONGQING'
      )
    ),

  unique (
    organization_id,
    provider,
    external_order_id
  )
);


create index
pos_orders_outlet_business_date_idx
on public.pos_orders (
  outlet_id,
  business_date desc
);


create index
pos_orders_void_idx
on public.pos_orders (
  organization_id,
  outlet_id,
  business_date,
  is_void
);


create index
pos_orders_updated_idx
on public.pos_orders (
  organization_id,
  external_updated_at desc
);


create trigger pos_orders_set_updated_at
before update
on public.pos_orders
for each row
execute function public.set_updated_at();


-- ============================================================
-- 4. NORMALIZED ORDER ITEMS
-- ============================================================

create table public.pos_order_items (
  id uuid
    primary key
    default gen_random_uuid(),

  organization_id uuid
    not null
    references public.organizations(id)
    on delete restrict,

  outlet_id uuid
    not null
    references public.outlets(id)
    on delete restrict,

  pos_order_id uuid
    not null
    references public.pos_orders(id)
    on delete cascade,

  provider text
    not null
    default 'CHONGQING',

  external_item_id bigint
    not null,

  external_order_id bigint
    not null,

  menu_id bigint,

  sku text,

  variant_id bigint,

  variant_sku text,

  name text
    not null,

  qty numeric
    not null
    default 0,

  price numeric
    not null
    default 0,

  total_price numeric
    not null
    default 0,

  discount numeric
    not null
    default 0,

  complimentary boolean
    not null
    default false,

  is_package boolean
    not null
    default false,

  is_half_portion boolean
    not null
    default false,

  is_three_portion boolean
    not null
    default false,

  is_personal boolean
    not null
    default false,

  is_glass boolean
    not null
    default false,

  is_cashback boolean
    not null
    default false,

  is_void boolean
    not null
    default false,

  void_reason text,

  void_time_raw text,

  void_by_raw text,

  void_manager_by_raw text,

  pos_user_id bigint,

  business_date date
    not null,

  external_created_at timestamptz,

  external_updated_at timestamptz,

  raw_payload jsonb
    not null
    default '{}'::jsonb,

  last_synced_at timestamptz
    not null
    default now(),

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  constraint pos_order_items_provider_chk
    check (
      provider in (
        'CHONGQING'
      )
    ),

  constraint pos_order_items_name_chk
    check (
      btrim(name) <> ''
    ),

  unique (
    organization_id,
    provider,
    external_item_id
  )
);


create index
pos_order_items_order_idx
on public.pos_order_items (
  pos_order_id
);


create index
pos_order_items_outlet_business_date_idx
on public.pos_order_items (
  outlet_id,
  business_date desc
);


create index
pos_order_items_void_idx
on public.pos_order_items (
  organization_id,
  outlet_id,
  business_date,
  is_void
);


create index
pos_order_items_complimentary_idx
on public.pos_order_items (
  organization_id,
  outlet_id,
  business_date,
  complimentary
);


create trigger pos_order_items_set_updated_at
before update
on public.pos_order_items
for each row
execute function public.set_updated_at();


-- ============================================================
-- 5. SYNC LOG
-- ============================================================

create table public.pos_sync_runs (
  id uuid
    primary key
    default gen_random_uuid(),

  organization_id uuid
    not null
    references public.organizations(id)
    on delete restrict,

  provider text
    not null
    default 'CHONGQING',

  sync_type text
    not null
    default 'ORDERS',

  status text
    not null
    default 'RUNNING',

  date_from text,

  date_to text,

  pages_processed integer
    not null
    default 0,

  orders_seen integer
    not null
    default 0,

  orders_upserted integer
    not null
    default 0,

  items_upserted integer
    not null
    default 0,

  unmapped_orders integer
    not null
    default 0,

  error_message text,

  created_by uuid
    references auth.users(id)
    on delete set null,

  started_at timestamptz
    not null
    default now(),

  completed_at timestamptz,

  created_at timestamptz
    not null
    default now(),

  constraint pos_sync_runs_provider_chk
    check (
      provider in (
        'CHONGQING'
      )
    ),

  constraint pos_sync_runs_type_chk
    check (
      sync_type in (
        'BRANCHES',
        'ORDERS'
      )
    ),

  constraint pos_sync_runs_status_chk
    check (
      status in (
        'RUNNING',
        'SUCCESS',
        'PARTIAL',
        'FAILED'
      )
    )
);


create index
pos_sync_runs_org_started_idx
on public.pos_sync_runs (
  organization_id,
  started_at desc
);


-- ============================================================
-- 6. RLS
--
-- External API data is server-side only.
-- ============================================================

alter table public.pos_external_branches
  enable row level security;

alter table public.pos_branch_mappings
  enable row level security;

alter table public.pos_orders
  enable row level security;

alter table public.pos_order_items
  enable row level security;

alter table public.pos_sync_runs
  enable row level security;


revoke all
on public.pos_external_branches,
   public.pos_branch_mappings,
   public.pos_orders,
   public.pos_order_items,
   public.pos_sync_runs
from public, anon, authenticated;


grant
  select,
  insert,
  update,
  delete
on public.pos_external_branches,
   public.pos_branch_mappings,
   public.pos_orders,
   public.pos_order_items,
   public.pos_sync_runs
to service_role;


-- ============================================================
-- 7. PERMISSIONS
-- ============================================================

insert into public.permissions (
  organization_id,
  code,
  name,
  description,
  is_active
)
select
  o.id,
  seed.code,
  seed.name,
  seed.description,
  true
from public.organizations o
cross join (
  values
    (
      'pos.manage',
      'Manage POS Integration',
      'Configure POS branch mappings and run synchronization.'
    ),
    (
      'pos.view',
      'View POS Analytics',
      'View normalized POS sales, void and complimentary analytics.'
    )
) as seed(
  code,
  name,
  description
)
on conflict (
  organization_id,
  code
)
do update set
  name =
    excluded.name,

  description =
    excluded.description,

  is_active =
    true,

  updated_at =
    now();


-- ORG_ADMIN can configure and view.
insert into public.role_permissions (
  role_id,
  permission_id,
  is_allowed
)
select
  r.id,
  p.id,
  true
from public.roles r
join public.permissions p
  on p.organization_id =
     r.organization_id
where
  r.code =
    'ORG_ADMIN'
  and p.code in (
    'pos.manage',
    'pos.view'
  )
  and r.is_active =
    true
on conflict (
  role_id,
  permission_id
)
do update set
  is_allowed =
    true,

  updated_at =
    now();


-- Management / BOD are read-only consumers if those roles exist.
insert into public.role_permissions (
  role_id,
  permission_id,
  is_allowed
)
select
  r.id,
  p.id,
  true
from public.roles r
join public.permissions p
  on p.organization_id =
     r.organization_id
where
  r.code in (
    'MANAGEMENT',
    'BOD'
  )
  and p.code =
    'pos.view'
  and r.is_active =
    true
on conflict (
  role_id,
  permission_id
)
do update set
  is_allowed =
    true,

  updated_at =
    now();


notify pgrst, 'reload schema';

commit;
