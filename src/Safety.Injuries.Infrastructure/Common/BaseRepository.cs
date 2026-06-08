using Microsoft.EntityFrameworkCore;
using Safety.Injuries.Domain.Interfaces;
using Safety.Injuries.Infrastructure.Data;
using System.Linq.Expressions;

namespace Safety.Injuries.Infrastructure.Common;

/// <summary>
/// Абстрактный базовый репозиторий, реализующий общие CRUD-операции для всех сущностей.
/// </summary>
/// <typeparam name="T">Тип сущности, с которой работает репозиторий (должен быть классом).</typeparam>
public abstract class BaseRepository<T> : IRepository<T> where T : class
{
    /// <summary>
    /// Контекст базы данных, используемый для доступа к Entity Framework.
    /// </summary>
    protected readonly SafetyInjuriesDbContext _context;

    /// <summary>
    /// DbSet для сущности типа T.
    /// Обеспечивает прямой доступ к набору данных.
    /// </summary>
    protected readonly DbSet<T> _dbSet;

    /// <summary>
    /// Инициализирует новый экземпляр базового репозитория.
    /// </summary>
    /// <param name="context">Контекст базы данных <see cref="SafetyInjuriesDbContext"/>.</param>
    protected BaseRepository(SafetyInjuriesDbContext context)
    {
        _context = context;
        _dbSet = context.Set<T>();
    }

    /// <inheritdoc />
    public virtual async Task<T> GetByIdAsync(Guid id)
    {
        return await _dbSet.FindAsync(id);
    }

    /// <inheritdoc />
    public virtual async Task<IEnumerable<T>> GetAllAsync()
    {
        return await _dbSet.ToListAsync();
    }

    /// <inheritdoc />
    public virtual async Task<IEnumerable<T>> FindAsync(Expression<Func<T, bool>> predicate)
    {
        return await _dbSet.Where(predicate).ToListAsync();
    }

    /// <inheritdoc />
    public virtual async Task<int> CountAsync(Expression<Func<T, bool>> predicate)
    {
        return await _dbSet.CountAsync(predicate);
    }

    /// <inheritdoc />
    public virtual async Task<T> AddAsync(T entity)
    {
        await _dbSet.AddAsync(entity);
        await _context.SaveChangesAsync();
        return entity;
    }

    /// <inheritdoc />
    public virtual async Task<T> UpdateAsync(T entity)
    {
        _dbSet.Update(entity);
        await _context.SaveChangesAsync();
        return entity;
    }

    /// <inheritdoc />
    public virtual async Task DeleteAsync(T entity)
    {
        _dbSet.Remove(entity);
        await _context.SaveChangesAsync();
    }

    /// <inheritdoc />
    public virtual async Task<bool> ExistsAsync(Guid id)
    {
        return await _dbSet.FindAsync(id) != null;
    }
}