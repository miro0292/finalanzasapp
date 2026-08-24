-- Ejecuta esto completo en Supabase: Project > SQL Editor > New query > Run.
-- Si ya habías corrido una versión anterior de este archivo, borra las tablas
-- viejas primero (drop table if exists fixed_expenses, daily_expenses, income,
-- savings, push_subscriptions cascade;) antes de correr este archivo.

create extension if not exists pgcrypto;

-- Productos financieros: tarjetas de crédito, cuentas de ahorro, créditos,
-- billeteras digitales (Nequi, Daviplata...). El efectivo NO se guarda aquí,
-- se representa como "sin cuenta" en los movimientos.
create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,                 -- ej: "Nequi", "Bancolombia Ahorros", "Tarjeta Visa"
  type text not null,                 -- 'tarjeta_credito' | 'ahorros' | 'credito' | 'billetera'
  credit_limit numeric,               -- solo aplica a tarjeta_credito / credito
  balance numeric default 0,          -- saldo o cupo disponible, opcional de llevar
  cutoff_day int,                     -- día de corte (tarjetas de crédito)
  payment_day int,                    -- día de pago (tarjetas de crédito / créditos)
  created_at timestamptz not null default now()
);

-- Deudas y cuentas fijas recurrentes: acueducto, luz, internet, arriendo...
create table if not exists debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  amount numeric not null,
  due_day int not null check (due_day between 1 and 31),      -- fecha de vencimiento
  max_pay_day int check (max_pay_day between 1 and 31),        -- fecha máxima antes de recargo/corte
  account_id uuid references accounts(id) on delete set null,  -- desde qué cuenta se paga normalmente
  category text not null default 'general',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Gastos diarios / hormiga, ahora con el medio de pago.
create table if not exists daily_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  amount numeric not null,
  category text not null default 'hormiga',
  account_id uuid references accounts(id) on delete set null,  -- null = pagado en efectivo
  spent_on date not null default current_date,
  created_at timestamptz not null default now()
);

-- Ingresos, con día esperado para los que son recurrentes.
create table if not exists income (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  amount numeric not null,
  kind text not null default 'fijo',   -- 'fijo' | 'eventual'
  expected_day int check (expected_day between 1 and 31), -- solo si kind = 'fijo'
  account_id uuid references accounts(id) on delete set null,  -- a qué cuenta entra
  received_on date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists savings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  amount numeric not null,
  goal_amount numeric,
  account_id uuid references accounts(id) on delete set null,
  moved_on date not null default current_date,
  created_at timestamptz not null default now()
);

-- Pagos programados a largo plazo, importados desde Excel (créditos,
-- cuotas, planes de pago) o creados por el chat de IA.
create table if not exists scheduled_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  debt_name text not null,
  due_date date not null,
  amount numeric not null,
  account_id uuid references accounts(id) on delete set null,
  status text not null default 'pendiente',  -- 'pendiente' | 'pagado'
  notes text,
  source text not null default 'manual',      -- 'manual' | 'excel' | 'ia'
  created_at timestamptz not null default now()
);

-- Historial de conversación con el asistente, incluyendo sugerencias de
-- cambios que el usuario debe confirmar antes de que se apliquen.
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,                 -- 'user' | 'assistant'
  content text not null,
  suggestion jsonb,                   -- acción propuesta (tipo, título, detalle, datos)
  suggestion_status text,             -- 'pending' | 'confirmed' | 'dismissed'
  created_at timestamptz not null default now()
);

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription jsonb not null,
  created_at timestamptz not null default now()
);

alter table accounts enable row level security;
alter table debts enable row level security;
alter table daily_expenses enable row level security;
alter table income enable row level security;
alter table savings enable row level security;
alter table scheduled_payments enable row level security;
alter table chat_messages enable row level security;
alter table push_subscriptions enable row level security;

create policy "own rows only" on accounts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows only" on debts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows only" on daily_expenses for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows only" on income for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows only" on savings for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows only" on scheduled_payments for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows only" on chat_messages for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows only" on push_subscriptions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
